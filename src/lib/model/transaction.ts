import * as assert from 'assert';
import { AddonLicenseId, ContactInfo, getContactInfo, getPartnerInfo, maybeGetContactInfo, PartnerInfo } from "./marketplace/common.js";
import { RawTransaction } from "./marketplace/raw.js";

export interface TransactionData {
  addonLicenseId: AddonLicenseId,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,

  technicalContact: ContactInfo,
  billingContact: ContactInfo | null,
  partnerDetails: PartnerInfo | null,

  company: string,
  country: string,
  region: string,

  tier: string,
  licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY',
  hosting: 'Server' | 'Cloud' | 'Data Center',
  maintenanceStartDate: string,
  maintenanceEndDate: string,

  transactionId: string,
  saleDate: string,
  saleType: 'Renewal' | 'Upgrade' | 'New' | 'Refund',

  billingPeriod: string,

  purchasePrice: number,
  vendorAmount: number,
}

export class Transaction {

  /** Unique ID for this Transaction. */
  public id: string;
  public data: TransactionData;
  public tier: number;

  constructor(rawTransaction: RawTransaction) {
    this.data = {
      transactionId: rawTransaction.transactionId,

      addonLicenseId: rawTransaction.addonLicenseId,
      licenseId: rawTransaction.licenseId,
      addonKey: rawTransaction.addonKey,
      addonName: rawTransaction.addonName,
      lastUpdated: rawTransaction.lastUpdated,

      technicalContact: getContactInfo(rawTransaction.customerDetails.technicalContact),
      billingContact: maybeGetContactInfo(rawTransaction.customerDetails.billingContact),
      partnerDetails: getPartnerInfo(rawTransaction.partnerDetails),

      company: rawTransaction.customerDetails.company,
      country: rawTransaction.customerDetails.country,
      region: rawTransaction.customerDetails.region,

      tier: rawTransaction.purchaseDetails.tier,
      licenseType: rawTransaction.purchaseDetails.licenseType,
      hosting: rawTransaction.purchaseDetails.hosting,
      maintenanceStartDate: rawTransaction.purchaseDetails.maintenanceStartDate,
      maintenanceEndDate: rawTransaction.purchaseDetails.maintenanceEndDate,

      saleDate: rawTransaction.purchaseDetails.saleDate,
      saleType: rawTransaction.purchaseDetails.saleType,
      billingPeriod: rawTransaction.purchaseDetails.billingPeriod,
      purchasePrice: rawTransaction.purchaseDetails.purchasePrice,
      vendorAmount: rawTransaction.purchaseDetails.vendorAmount,
    };

    this.id = `${this.data.transactionId}[${this.data.addonLicenseId}]`;
    this.tier = this.parseTier();
  }

  private parseTier() {
    const tier = this.data.tier;

    if (tier === 'Unlimited Users') return 10001;

    let m;
    if (m = tier.match(/^Per Unit Pricing \((\d+) users\)$/i)) {
      return +m[1];
    }
    if (m = tier.match(/^(\d+) Users$/)) {
      return +m[1];
    }

    assert.fail(`Unknown transaction tier: ${tier}`);
  }

}
