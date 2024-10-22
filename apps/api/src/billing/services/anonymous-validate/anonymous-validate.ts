import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";
import { EncodeObject } from "@cosmjs/proto-signing";
import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";
import { ChainErrorService } from "../chain-error/chain-error.service";

@singleton()
export class AnonymousValidateService {
  private readonly authorizedProviders = [
    "akash1824w2vqx57n8zr8707dnyh85kjrkfkrrs94pk9",
    "akash19ah5c95kq4kz2g6q5rdkdgt80kc3xycsd8plq8",
    "akash1g7az2pus6atgeufgttlcnl0wzlzwd0lrsy6d7s",
    "akash1tfuvntkwt3cpxnhukdnsvvsumjnrvmvh244l3w",
    "akash18mcffkg5jp9eqc36evlv67uqcj04fvk324ap54",
    "akash1t0sk5nhc8n3xply5ft60x9det0s7jwplzzycnv",
    "akash1cnzkdynwd4u6j7s8z5j0fg76h3g6yhsggmuqta",
    "akash1eyrkgz2ufjs27hnpe3jekemp8anrfk8tqzhpsn",
    "akash15tl6v6gd0nte0syyxnv57zmmspgju4c3xfmdhk",
    "akash1rfqs6aajq2d4azhjj88wav2d6ra6vvuzn58dt5",
    "akash16aflfteeg8c2j63sy0rlxj57pty98zzm5mvgfa"
  ];

  constructor(private readonly chainErrorService: ChainErrorService) {}

  validateLeaseProviders(decoded: EncodeObject, userWallet: UserWalletOutput) {
    if (userWallet.isTrialing && decoded.typeUrl === "/akash.market.v1beta4.MsgCreateLease") {
      const value = decoded.value as v1beta4.MsgCreateLease;
      if (!this.authorizedProviders.includes(value.bidId.provider)) {
        throw new Error(`provider not authorized: ${value.bidId.provider}`);
      }
    }

    return true;
  }
}
