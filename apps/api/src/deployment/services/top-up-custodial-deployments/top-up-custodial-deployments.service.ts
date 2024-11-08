import { AllowanceHttpService, BalanceHttpService, DeploymentAllowance } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { ExecDepositDeploymentMsgOptions, MasterSigningClientService, RpcMessageService } from "@src/billing/services";
import { ErrorService } from "@src/core/services/error/error.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { TopUpToolsService } from "@src/deployment/services/top-up-tools/top-up-tools.service";

interface Balances {
  denom: string;
  feesLimit: number;
  deploymentLimit: number;
  balance: number;
}

@singleton()
export class TopUpCustodialDeploymentsService {
  private readonly CONCURRENCY = 10;

  private readonly MIN_FEES_AVAILABLE = 5000;

  private readonly logger = new LoggerService({ context: TopUpCustodialDeploymentsService.name });

  constructor(
    private readonly topUpToolsService: TopUpToolsService,
    private readonly allowanceHttpService: AllowanceHttpService,
    private readonly balanceHttpService: BalanceHttpService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly rpcClientService: RpcMessageService,
    private readonly errorService: ErrorService
  ) {}

  async topUpDeployments() {
    const topUpAllCustodialDeployments = this.topUpToolsService.pairs.map(async ({ wallet, client }) => {
      const address = await wallet.getFirstAddress();
      await this.allowanceHttpService.paginateDeploymentGrants({ grantee: address, limit: this.CONCURRENCY }, async grants => {
        await Promise.all(
          grants.map(async grant => {
            await this.errorService.execWithErrorHandler({ grant, event: "TOP_UP_ERROR" }, () => this.topUpForGrant(grant, client));
          })
        );
      });
    });
    await Promise.all(topUpAllCustodialDeployments);
  }

  private async topUpForGrant(grant: DeploymentAllowance, client: MasterSigningClientService) {
    const owner = grant.granter;
    const { grantee } = grant;

    const balances = await this.collectWalletBalances(grant);

    const drainingDeployments = await this.drainingDeploymentService.findDeployments(owner, balances.denom);
    let { deploymentLimit, feesLimit, balance } = balances;

    for (const { dseq, denom, blockRate } of drainingDeployments) {
      const amount = await this.drainingDeploymentService.calculateTopUpAmount({ blockRate });
      if (!this.canTopUp(amount, { deploymentLimit, feesLimit, balance })) {
        this.logger.info({ event: "INSUFFICIENT_BALANCE", granter: owner, grantee, balances: { deploymentLimit, feesLimit, balance } });
        break;
      }
      deploymentLimit -= amount;
      feesLimit -= this.MIN_FEES_AVAILABLE;
      balance -= amount + this.MIN_FEES_AVAILABLE;

      await this.topUpDeployment(
        {
          dseq,
          amount,
          denom,
          owner,
          grantee
        },
        client
      );
    }
  }

  private async collectWalletBalances(grant: DeploymentAllowance): Promise<Balances> {
    const denom = grant.authorization.spend_limit.denom;
    const deploymentLimit = parseFloat(grant.authorization.spend_limit.amount);

    const feesLimit = await this.retrieveFeesLimit(grant.granter, grant.grantee, denom);
    const { amount } = await this.balanceHttpService.getBalance(grant.granter, denom);
    const balance = parseFloat(amount);

    return {
      denom,
      feesLimit,
      deploymentLimit,
      balance
    };
  }

  private async retrieveFeesLimit(granter: string, grantee: string, denom: string) {
    const feesAllowance = await this.allowanceHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee);
    const feesSpendLimit = feesAllowance.allowance.spend_limit.find(limit => limit.denom === denom);

    return feesSpendLimit ? parseFloat(feesSpendLimit.amount) : 0;
  }

  private canTopUp(amount: number, balances: Pick<Balances, "balance" | "deploymentLimit" | "feesLimit">) {
    return balances.deploymentLimit > amount && balances.feesLimit > this.MIN_FEES_AVAILABLE && balances.balance > amount + this.MIN_FEES_AVAILABLE;
  }

  async topUpDeployment({ grantee, ...messageInput }: ExecDepositDeploymentMsgOptions, client: MasterSigningClientService) {
    const message = this.rpcClientService.getExecDepositDeploymentMsg({ grantee, ...messageInput });
    this.logger.info({ event: "TOP_UP_DEPLOYMENT", params: { ...messageInput, masterWallet: grantee } });

    await client.executeTx([message]);

    this.logger.info({ event: "TOP_UP_DEPLOYMENT_SUCCESS" });
  }
}
