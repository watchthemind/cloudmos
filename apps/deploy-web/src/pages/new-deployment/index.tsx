import { LoggerService } from "@akashnetwork/logging";
import { z } from "zod";

import { NewDeploymentContainer, NewDeploymentContainerProps } from "@src/components/new-deployment/NewDeploymentContainer";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSIdeProps";
import { services } from "@src/services/http/http-server.service";

export default withSdlBuilder()(NewDeploymentContainer);

const contextSchema = z.object({
  query: z.object({
    templateId: z.string().optional()
  })
});

const logger = LoggerService.forContext(NewDeploymentContainer.name);

export const getServerSideProps = getValidatedServerSideProps<NewDeploymentContainerProps, typeof contextSchema>(contextSchema, async ({ query }) => {
  if (!query.templateId) {
    return { props: {} };
  }

  try {
    const template = await services.template.findById(query.templateId);

    if (template && query.templateId) {
      return { props: { template, templateId: query.templateId } };
    }
  } catch (error) {
    if (error?.response?.status === 404) {
      logger.info(`Template not found: ${query.templateId}`);
    } else {
      logger.error(error);
    }
  }

  return { props: { templateId: query.templateId } };
});
