ALTER TABLE "ProductDataFlow"
ADD COLUMN "requiresApiKey" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProductIngressPoint"
ADD COLUMN "requiresApiKey" BOOLEAN NOT NULL DEFAULT false;
