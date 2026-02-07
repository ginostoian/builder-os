-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "VatMode" AS ENUM ('NONE', 'STANDARD');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('NONE', 'AMOUNT', 'PERCENT');

-- CreateEnum
CREATE TYPE "ItemRowType" AS ENUM ('SECTION_HEADER', 'LINE_ITEM');

-- CreateEnum
CREATE TYPE "CalcType" AS ENUM ('SELL_ONLY', 'UNIT_RATE', 'LABOUR_HOURS', 'ALLOWANCE');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "VariationPdfStage" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT DEFAULT 'UK',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "defaultVatMode" "VatMode" NOT NULL DEFAULT 'STANDARD',
    "defaultVatRateBps" INTEGER NOT NULL DEFAULT 2000,
    "defaultGrouping" TEXT NOT NULL DEFAULT 'ROOMS',
    "defaultShowQtyToClient" BOOLEAN NOT NULL DEFAULT false,
    "defaultShowUnitRatesToClient" BOOLEAN NOT NULL DEFAULT false,
    "defaultTermsJson" JSONB,
    "defaultScopeOverviewJson" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "referenceNo" TEXT,
    "projectAddress" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "vatMode" "VatMode" NOT NULL DEFAULT 'STANDARD',
    "vatRateBps" INTEGER NOT NULL DEFAULT 2000,
    "depositType" "DepositType" NOT NULL DEFAULT 'NONE',
    "depositAmountPence" INTEGER,
    "depositPercentBps" INTEGER,
    "paymentScheduleJson" JSONB,
    "showQtyToClient" BOOLEAN NOT NULL DEFAULT false,
    "showUnitRatesToClient" BOOLEAN NOT NULL DEFAULT false,
    "scopeOverviewJson" JSONB,
    "termsJson" JSONB,
    "estimatedStartDate" TIMESTAMP(3),
    "estimatedDurationWeeks" INTEGER,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "parentId" TEXT,
    "rowType" "ItemRowType" NOT NULL DEFAULT 'LINE_ITEM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roomTag" TEXT,
    "tradeTag" TEXT,
    "phaseTag" TEXT,
    "calcType" "CalcType" NOT NULL DEFAULT 'SELL_ONLY',
    "qty" DECIMAL(12,3),
    "unit" TEXT,
    "unitPricePence" INTEGER,
    "hours" DECIMAL(12,2),
    "hourlyRatePence" INTEGER,
    "sellPricePence" INTEGER,
    "isAllowance" BOOLEAN NOT NULL DEFAULT false,
    "costPence" INTEGER,
    "markupPercentBps" INTEGER,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVersion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL,
    "vatMode" "VatMode" NOT NULL,
    "vatRateBps" INTEGER NOT NULL,
    "depositType" "DepositType" NOT NULL,
    "depositAmountPence" INTEGER,
    "depositPercentBps" INTEGER,
    "showQtyToClient" BOOLEAN NOT NULL,
    "showUnitRatesToClient" BOOLEAN NOT NULL,
    "title" TEXT NOT NULL,
    "referenceNo" TEXT,
    "projectAddress" TEXT,
    "scopeOverviewJson" JSONB,
    "termsJson" JSONB,
    "paymentScheduleJson" JSONB,
    "subtotalPence" INTEGER,
    "vatPence" INTEGER,
    "totalPence" INTEGER,
    "sentAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVersionItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "parentId" TEXT,
    "sourceQuoteItemId" TEXT,
    "rowType" "ItemRowType" NOT NULL DEFAULT 'LINE_ITEM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roomTag" TEXT,
    "tradeTag" TEXT,
    "phaseTag" TEXT,
    "calcType" "CalcType" NOT NULL DEFAULT 'SELL_ONLY',
    "qty" DECIMAL(12,3),
    "unit" TEXT,
    "unitPricePence" INTEGER,
    "hours" DECIMAL(12,2),
    "hourlyRatePence" INTEGER,
    "sellPricePence" INTEGER,
    "isAllowance" BOOLEAN NOT NULL DEFAULT false,
    "lineTotalPence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteVersionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePublicLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotePublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePdf" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotePdf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAcceptance" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "acceptedName" TEXT NOT NULL,
    "acceptedEmail" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "calcType" "CalcType" NOT NULL DEFAULT 'SELL_ONLY',
    "defaultQty" DECIMAL(12,3),
    "defaultUnit" TEXT,
    "defaultUnitPricePence" INTEGER,
    "defaultHours" DECIMAL(12,2),
    "defaultHourlyRatePence" INTEGER,
    "defaultSellPricePence" INTEGER,
    "defaultIsAllowance" BOOLEAN NOT NULL DEFAULT false,
    "roomTag" TEXT,
    "tradeTag" TEXT,
    "phaseTag" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceBookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSectionItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "templateSectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "calcType" "CalcType" NOT NULL DEFAULT 'SELL_ONLY',
    "qty" DECIMAL(12,3),
    "unit" TEXT,
    "unitPricePence" INTEGER,
    "hours" DECIMAL(12,2),
    "hourlyRatePence" INTEGER,
    "sellPricePence" INTEGER,
    "isAllowance" BOOLEAN NOT NULL DEFAULT false,
    "roomTag" TEXT,
    "tradeTag" TEXT,
    "phaseTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "VariationStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "vatMode" "VatMode" NOT NULL DEFAULT 'STANDARD',
    "vatRateBps" INTEGER NOT NULL DEFAULT 2000,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "parentId" TEXT,
    "rowType" "ItemRowType" NOT NULL DEFAULT 'LINE_ITEM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "calcType" "CalcType" NOT NULL DEFAULT 'SELL_ONLY',
    "qty" DECIMAL(12,3),
    "unit" TEXT,
    "unitPricePence" INTEGER,
    "hours" DECIMAL(12,2),
    "hourlyRatePence" INTEGER,
    "sellPricePence" INTEGER,
    "isAllowance" BOOLEAN NOT NULL DEFAULT false,
    "roomTag" TEXT,
    "tradeTag" TEXT,
    "phaseTag" TEXT,
    "costPence" INTEGER,
    "markupPercentBps" INTEGER,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationApproval" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "approvedName" TEXT NOT NULL,
    "approvedEmail" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationPublicLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariationPublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationPdf" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "stage" "VariationPdfStage" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariationPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_orgId_key" ON "CompanySettings"("orgId");

-- CreateIndex
CREATE INDEX "CompanySettings_orgId_idx" ON "CompanySettings"("orgId");

-- CreateIndex
CREATE INDEX "Client_orgId_idx" ON "Client"("orgId");

-- CreateIndex
CREATE INDEX "Client_orgId_name_idx" ON "Client"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_id_orgId_key" ON "Client"("id", "orgId");

-- CreateIndex
CREATE INDEX "Quote_orgId_idx" ON "Quote"("orgId");

-- CreateIndex
CREATE INDEX "Quote_orgId_status_idx" ON "Quote"("orgId", "status");

-- CreateIndex
CREATE INDEX "Quote_orgId_clientId_idx" ON "Quote"("orgId", "clientId");

-- CreateIndex
CREATE INDEX "Quote_orgId_referenceNo_idx" ON "Quote"("orgId", "referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_id_orgId_key" ON "Quote"("id", "orgId");

-- CreateIndex
CREATE INDEX "QuoteItem_orgId_idx" ON "QuoteItem"("orgId");

-- CreateIndex
CREATE INDEX "QuoteItem_orgId_quoteId_idx" ON "QuoteItem"("orgId", "quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_sortOrder_idx" ON "QuoteItem"("quoteId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuoteItem_orgId_roomTag_idx" ON "QuoteItem"("orgId", "roomTag");

-- CreateIndex
CREATE INDEX "QuoteItem_orgId_tradeTag_idx" ON "QuoteItem"("orgId", "tradeTag");

-- CreateIndex
CREATE INDEX "QuoteItem_orgId_phaseTag_idx" ON "QuoteItem"("orgId", "phaseTag");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteItem_id_orgId_key" ON "QuoteItem"("id", "orgId");

-- CreateIndex
CREATE INDEX "QuoteVersion_orgId_idx" ON "QuoteVersion"("orgId");

-- CreateIndex
CREATE INDEX "QuoteVersion_orgId_quoteId_idx" ON "QuoteVersion"("orgId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_id_orgId_key" ON "QuoteVersion"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_quoteId_version_key" ON "QuoteVersion"("quoteId", "version");

-- CreateIndex
CREATE INDEX "QuoteVersionItem_orgId_idx" ON "QuoteVersionItem"("orgId");

-- CreateIndex
CREATE INDEX "QuoteVersionItem_orgId_quoteVersionId_idx" ON "QuoteVersionItem"("orgId", "quoteVersionId");

-- CreateIndex
CREATE INDEX "QuoteVersionItem_quoteVersionId_sortOrder_idx" ON "QuoteVersionItem"("quoteVersionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersionItem_id_orgId_key" ON "QuoteVersionItem"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotePublicLink_tokenHash_key" ON "QuotePublicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "QuotePublicLink_orgId_idx" ON "QuotePublicLink"("orgId");

-- CreateIndex
CREATE INDEX "QuotePublicLink_orgId_quoteId_idx" ON "QuotePublicLink"("orgId", "quoteId");

-- CreateIndex
CREATE INDEX "QuotePublicLink_orgId_quoteId_isActive_idx" ON "QuotePublicLink"("orgId", "quoteId", "isActive");

-- CreateIndex
CREATE INDEX "QuotePdf_orgId_idx" ON "QuotePdf"("orgId");

-- CreateIndex
CREATE INDEX "QuotePdf_orgId_quoteId_idx" ON "QuotePdf"("orgId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotePdf_quoteId_version_key" ON "QuotePdf"("quoteId", "version");

-- CreateIndex
CREATE INDEX "QuoteAcceptance_orgId_idx" ON "QuoteAcceptance"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAcceptance_quoteId_orgId_key" ON "QuoteAcceptance"("quoteId", "orgId");

-- CreateIndex
CREATE INDEX "PriceBookItem_orgId_idx" ON "PriceBookItem"("orgId");

-- CreateIndex
CREATE INDEX "PriceBookItem_orgId_title_idx" ON "PriceBookItem"("orgId", "title");

-- CreateIndex
CREATE INDEX "PriceBookItem_orgId_isFavorite_idx" ON "PriceBookItem"("orgId", "isFavorite");

-- CreateIndex
CREATE INDEX "TemplateSection_orgId_idx" ON "TemplateSection"("orgId");

-- CreateIndex
CREATE INDEX "TemplateSection_orgId_name_idx" ON "TemplateSection"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSection_id_orgId_key" ON "TemplateSection"("id", "orgId");

-- CreateIndex
CREATE INDEX "TemplateSectionItem_orgId_idx" ON "TemplateSectionItem"("orgId");

-- CreateIndex
CREATE INDEX "TemplateSectionItem_orgId_templateSectionId_idx" ON "TemplateSectionItem"("orgId", "templateSectionId");

-- CreateIndex
CREATE INDEX "TemplateSectionItem_templateSectionId_sortOrder_idx" ON "TemplateSectionItem"("templateSectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "Variation_orgId_idx" ON "Variation"("orgId");

-- CreateIndex
CREATE INDEX "Variation_orgId_quoteId_idx" ON "Variation"("orgId", "quoteId");

-- CreateIndex
CREATE INDEX "Variation_orgId_status_idx" ON "Variation"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Variation_id_orgId_key" ON "Variation"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Variation_quoteId_number_key" ON "Variation"("quoteId", "number");

-- CreateIndex
CREATE INDEX "VariationItem_orgId_idx" ON "VariationItem"("orgId");

-- CreateIndex
CREATE INDEX "VariationItem_orgId_variationId_idx" ON "VariationItem"("orgId", "variationId");

-- CreateIndex
CREATE INDEX "VariationItem_variationId_sortOrder_idx" ON "VariationItem"("variationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VariationItem_id_orgId_key" ON "VariationItem"("id", "orgId");

-- CreateIndex
CREATE INDEX "VariationApproval_orgId_idx" ON "VariationApproval"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "VariationApproval_variationId_orgId_key" ON "VariationApproval"("variationId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "VariationPublicLink_tokenHash_key" ON "VariationPublicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "VariationPublicLink_orgId_idx" ON "VariationPublicLink"("orgId");

-- CreateIndex
CREATE INDEX "VariationPublicLink_orgId_variationId_idx" ON "VariationPublicLink"("orgId", "variationId");

-- CreateIndex
CREATE INDEX "VariationPublicLink_orgId_variationId_isActive_idx" ON "VariationPublicLink"("orgId", "variationId", "isActive");

-- CreateIndex
CREATE INDEX "VariationPdf_orgId_idx" ON "VariationPdf"("orgId");

-- CreateIndex
CREATE INDEX "VariationPdf_orgId_variationId_idx" ON "VariationPdf"("orgId", "variationId");

-- CreateIndex
CREATE UNIQUE INDEX "VariationPdf_variationId_stage_key" ON "VariationPdf"("variationId", "stage");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_orgId_fkey" FOREIGN KEY ("clientId", "orgId") REFERENCES "Client"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "Quote"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_parentId_orgId_fkey" FOREIGN KEY ("parentId", "orgId") REFERENCES "QuoteItem"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "Quote"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersionItem" ADD CONSTRAINT "QuoteVersionItem_quoteVersionId_orgId_fkey" FOREIGN KEY ("quoteVersionId", "orgId") REFERENCES "QuoteVersion"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersionItem" ADD CONSTRAINT "QuoteVersionItem_parentId_orgId_fkey" FOREIGN KEY ("parentId", "orgId") REFERENCES "QuoteVersionItem"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePublicLink" ADD CONSTRAINT "QuotePublicLink_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "Quote"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePdf" ADD CONSTRAINT "QuotePdf_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "Quote"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAcceptance" ADD CONSTRAINT "QuoteAcceptance_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "Quote"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSectionItem" ADD CONSTRAINT "TemplateSectionItem_templateSectionId_orgId_fkey" FOREIGN KEY ("templateSectionId", "orgId") REFERENCES "TemplateSection"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "Quote"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItem" ADD CONSTRAINT "VariationItem_variationId_orgId_fkey" FOREIGN KEY ("variationId", "orgId") REFERENCES "Variation"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationItem" ADD CONSTRAINT "VariationItem_parentId_orgId_fkey" FOREIGN KEY ("parentId", "orgId") REFERENCES "VariationItem"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationApproval" ADD CONSTRAINT "VariationApproval_variationId_orgId_fkey" FOREIGN KEY ("variationId", "orgId") REFERENCES "Variation"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationPublicLink" ADD CONSTRAINT "VariationPublicLink_variationId_orgId_fkey" FOREIGN KEY ("variationId", "orgId") REFERENCES "Variation"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationPdf" ADD CONSTRAINT "VariationPdf_variationId_orgId_fkey" FOREIGN KEY ("variationId", "orgId") REFERENCES "Variation"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

