-- BuilderOS guardrails: enforce numeric ranges and conditional deposit validity.

-- Company-level defaults
ALTER TABLE "CompanySettings"
  ADD CONSTRAINT "CompanySettings_defaultVatRateBps_range_chk"
  CHECK ("defaultVatRateBps" BETWEEN 0 AND 10000);

-- Quote validity
ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_currentVersion_min_chk"
  CHECK ("currentVersion" >= 1),
  ADD CONSTRAINT "Quote_vatRateBps_range_chk"
  CHECK ("vatRateBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "Quote_estimatedDurationWeeks_nonneg_chk"
  CHECK ("estimatedDurationWeeks" IS NULL OR "estimatedDurationWeeks" >= 0),
  ADD CONSTRAINT "Quote_deposit_logic_chk"
  CHECK (
    (
      "depositType" = 'NONE'::"DepositType"
      AND "depositAmountPence" IS NULL
      AND "depositPercentBps" IS NULL
    )
    OR (
      "depositType" = 'AMOUNT'::"DepositType"
      AND "depositAmountPence" IS NOT NULL
      AND "depositAmountPence" >= 0
      AND "depositPercentBps" IS NULL
    )
    OR (
      "depositType" = 'PERCENT'::"DepositType"
      AND "depositPercentBps" IS NOT NULL
      AND "depositPercentBps" BETWEEN 0 AND 10000
      AND "depositAmountPence" IS NULL
    )
  );

-- QuoteItem guardrails
ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "QuoteItem_sortOrder_nonneg_chk"
  CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "QuoteItem_qty_nonneg_chk"
  CHECK ("qty" IS NULL OR "qty" >= 0),
  ADD CONSTRAINT "QuoteItem_hours_nonneg_chk"
  CHECK ("hours" IS NULL OR "hours" >= 0),
  ADD CONSTRAINT "QuoteItem_money_nonneg_chk"
  CHECK (
    ("unitPricePence" IS NULL OR "unitPricePence" >= 0)
    AND ("hourlyRatePence" IS NULL OR "hourlyRatePence" >= 0)
    AND ("sellPricePence" IS NULL OR "sellPricePence" >= 0)
    AND ("costPence" IS NULL OR "costPence" >= 0)
  ),
  ADD CONSTRAINT "QuoteItem_markupPercentBps_range_chk"
  CHECK ("markupPercentBps" IS NULL OR "markupPercentBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "QuoteItem_allowance_alignment_chk"
  CHECK (
    ("calcType" = 'ALLOWANCE'::"CalcType" AND "isAllowance" = true)
    OR ("calcType" <> 'ALLOWANCE'::"CalcType" AND "isAllowance" = false)
  );

-- QuoteVersion guardrails
ALTER TABLE "QuoteVersion"
  ADD CONSTRAINT "QuoteVersion_version_min_chk"
  CHECK ("version" >= 1),
  ADD CONSTRAINT "QuoteVersion_vatRateBps_range_chk"
  CHECK ("vatRateBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "QuoteVersion_totals_nonneg_chk"
  CHECK (
    ("subtotalPence" IS NULL OR "subtotalPence" >= 0)
    AND ("vatPence" IS NULL OR "vatPence" >= 0)
    AND ("totalPence" IS NULL OR "totalPence" >= 0)
  ),
  ADD CONSTRAINT "QuoteVersion_deposit_logic_chk"
  CHECK (
    (
      "depositType" = 'NONE'::"DepositType"
      AND "depositAmountPence" IS NULL
      AND "depositPercentBps" IS NULL
    )
    OR (
      "depositType" = 'AMOUNT'::"DepositType"
      AND "depositAmountPence" IS NOT NULL
      AND "depositAmountPence" >= 0
      AND "depositPercentBps" IS NULL
    )
    OR (
      "depositType" = 'PERCENT'::"DepositType"
      AND "depositPercentBps" IS NOT NULL
      AND "depositPercentBps" BETWEEN 0 AND 10000
      AND "depositAmountPence" IS NULL
    )
  );

-- QuoteVersionItem guardrails
ALTER TABLE "QuoteVersionItem"
  ADD CONSTRAINT "QuoteVersionItem_sortOrder_nonneg_chk"
  CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "QuoteVersionItem_qty_nonneg_chk"
  CHECK ("qty" IS NULL OR "qty" >= 0),
  ADD CONSTRAINT "QuoteVersionItem_hours_nonneg_chk"
  CHECK ("hours" IS NULL OR "hours" >= 0),
  ADD CONSTRAINT "QuoteVersionItem_money_nonneg_chk"
  CHECK (
    ("unitPricePence" IS NULL OR "unitPricePence" >= 0)
    AND ("hourlyRatePence" IS NULL OR "hourlyRatePence" >= 0)
    AND ("sellPricePence" IS NULL OR "sellPricePence" >= 0)
    AND ("lineTotalPence" IS NULL OR "lineTotalPence" >= 0)
  ),
  ADD CONSTRAINT "QuoteVersionItem_allowance_alignment_chk"
  CHECK (
    ("calcType" = 'ALLOWANCE'::"CalcType" AND "isAllowance" = true)
    OR ("calcType" <> 'ALLOWANCE'::"CalcType" AND "isAllowance" = false)
  );

-- Public link view counters
ALTER TABLE "QuotePublicLink"
  ADD CONSTRAINT "QuotePublicLink_viewCount_nonneg_chk"
  CHECK ("viewCount" >= 0),
  ADD CONSTRAINT "QuotePublicLink_viewed_window_chk"
  CHECK (
    "firstViewedAt" IS NULL
    OR "lastViewedAt" IS NULL
    OR "firstViewedAt" <= "lastViewedAt"
  );

-- Price book guardrails
ALTER TABLE "PriceBookItem"
  ADD CONSTRAINT "PriceBookItem_defaultQty_nonneg_chk"
  CHECK ("defaultQty" IS NULL OR "defaultQty" >= 0),
  ADD CONSTRAINT "PriceBookItem_defaultHours_nonneg_chk"
  CHECK ("defaultHours" IS NULL OR "defaultHours" >= 0),
  ADD CONSTRAINT "PriceBookItem_money_nonneg_chk"
  CHECK (
    ("defaultUnitPricePence" IS NULL OR "defaultUnitPricePence" >= 0)
    AND ("defaultHourlyRatePence" IS NULL OR "defaultHourlyRatePence" >= 0)
    AND ("defaultSellPricePence" IS NULL OR "defaultSellPricePence" >= 0)
  ),
  ADD CONSTRAINT "PriceBookItem_allowance_alignment_chk"
  CHECK (
    ("calcType" = 'ALLOWANCE'::"CalcType" AND "defaultIsAllowance" = true)
    OR ("calcType" <> 'ALLOWANCE'::"CalcType" AND "defaultIsAllowance" = false)
  );

-- Template section item guardrails
ALTER TABLE "TemplateSectionItem"
  ADD CONSTRAINT "TemplateSectionItem_sortOrder_nonneg_chk"
  CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "TemplateSectionItem_qty_nonneg_chk"
  CHECK ("qty" IS NULL OR "qty" >= 0),
  ADD CONSTRAINT "TemplateSectionItem_hours_nonneg_chk"
  CHECK ("hours" IS NULL OR "hours" >= 0),
  ADD CONSTRAINT "TemplateSectionItem_money_nonneg_chk"
  CHECK (
    ("unitPricePence" IS NULL OR "unitPricePence" >= 0)
    AND ("hourlyRatePence" IS NULL OR "hourlyRatePence" >= 0)
    AND ("sellPricePence" IS NULL OR "sellPricePence" >= 0)
  ),
  ADD CONSTRAINT "TemplateSectionItem_allowance_alignment_chk"
  CHECK (
    ("calcType" = 'ALLOWANCE'::"CalcType" AND "isAllowance" = true)
    OR ("calcType" <> 'ALLOWANCE'::"CalcType" AND "isAllowance" = false)
  );

-- Variation guardrails
ALTER TABLE "Variation"
  ADD CONSTRAINT "Variation_number_min_chk"
  CHECK ("number" >= 1),
  ADD CONSTRAINT "Variation_vatRateBps_range_chk"
  CHECK ("vatRateBps" BETWEEN 0 AND 10000);

ALTER TABLE "VariationItem"
  ADD CONSTRAINT "VariationItem_sortOrder_nonneg_chk"
  CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "VariationItem_qty_nonneg_chk"
  CHECK ("qty" IS NULL OR "qty" >= 0),
  ADD CONSTRAINT "VariationItem_hours_nonneg_chk"
  CHECK ("hours" IS NULL OR "hours" >= 0),
  ADD CONSTRAINT "VariationItem_money_nonneg_chk"
  CHECK (
    ("unitPricePence" IS NULL OR "unitPricePence" >= 0)
    AND ("hourlyRatePence" IS NULL OR "hourlyRatePence" >= 0)
    AND ("sellPricePence" IS NULL OR "sellPricePence" >= 0)
    AND ("costPence" IS NULL OR "costPence" >= 0)
  ),
  ADD CONSTRAINT "VariationItem_markupPercentBps_range_chk"
  CHECK ("markupPercentBps" IS NULL OR "markupPercentBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "VariationItem_allowance_alignment_chk"
  CHECK (
    ("calcType" = 'ALLOWANCE'::"CalcType" AND "isAllowance" = true)
    OR ("calcType" <> 'ALLOWANCE'::"CalcType" AND "isAllowance" = false)
  );

ALTER TABLE "VariationPublicLink"
  ADD CONSTRAINT "VariationPublicLink_viewCount_nonneg_chk"
  CHECK ("viewCount" >= 0),
  ADD CONSTRAINT "VariationPublicLink_viewed_window_chk"
  CHECK (
    "firstViewedAt" IS NULL
    OR "lastViewedAt" IS NULL
    OR "firstViewedAt" <= "lastViewedAt"
  );
