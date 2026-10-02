-- The Wiz tag value a product answers to.
--
-- Completes the set: CompanyToolLink holds the folder, ApplicationToolLink the
-- application's tag value, and this the product's. A product page filters its
-- cloud resources by folder + this value; an application page adds its own on top.
--
-- Assigned rather than matched by name. A company's tag values will not equal
-- Orbit's record names, and depending on that would make the whole feature rest
-- on a naming convention nobody has agreed to.

CREATE TABLE "ProductToolLink" (
  "id"        TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "provider"  TEXT NOT NULL,
  "filter"    JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductToolLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductToolLink" ADD CONSTRAINT "ProductToolLink_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProductToolLink_productId_provider_key"
  ON "ProductToolLink"("productId", "provider");
CREATE INDEX "ProductToolLink_provider_idx" ON "ProductToolLink"("provider");
