import config from "../config/index.js";
import { AttachableError } from "../util/errors.js";
import { isPresent } from "../util/helpers.js";
import { Company } from "./company.js";
import { Contact } from "./contact.js";
import { Entity } from "./hubspot/entity.js";
import { DealStage, EntityKind, Pipeline } from "./hubspot/interfaces.js";
import { EntityManager, PropertyTransformers } from "./hubspot/manager.js";
import { License } from "./license.js";
import { Transaction } from "./transaction.js";

const addonLicenseIdKey = config.hubspot.attrs.deal.addonLicenseId;
const transactionIdKey = config.hubspot.attrs.deal.transactionId;
const deploymentKey = config.hubspot.attrs.deal.deployment;
const appKey = config.hubspot.attrs.deal.app;

export type DealData = {
  relatedProducts: string | null;
  app: string | null;
  addonLicenseId: string | null;
  transactionId: string | null;
  closeDate: string;
  country: string;
  dealName: string;
  origin: string | null;
  deployment: 'Server' | 'Cloud' | 'Data Center' | null;
  licenseTier: number;
  pipeline: Pipeline;
  dealstage: DealStage;
  amount: number | null;
  readonly hasActivity: boolean;
};

export class Deal extends Entity<DealData> {

  contacts = this.makeDynamicAssociation<Contact>('contact');
  companies = this.makeDynamicAssociation<Company>('company');

  isEval() { return this.data.dealstage === DealStage.EVAL; }
  isClosed() {
    return (
      this.data.dealstage === DealStage.CLOSED_LOST ||
      this.data.dealstage === DealStage.CLOSED_WON
    );
  }

}

export class DealManager extends EntityManager<DealData, Deal> {

  override Entity = Deal;
  override kind: EntityKind = "deal";

  override associations: EntityKind[] = [
    "company",
    "contact",
  ];

  override apiProperties: string[] = [
    // Required
    'closedate',
    'license_tier',
    'country',
    'origin',
    'related_products',
    'dealname',
    'dealstage',
    'pipeline',
    'amount',

    // User-configurable
    addonLicenseIdKey,
    transactionIdKey,
    ...[
      deploymentKey,
      appKey,
    ].filter(isPresent),

    // For checking activity in duplicates
    'hs_user_ids_of_all_owners',
    'engagements_last_meeting_booked',
    'hs_latest_meeting_activity',
    'notes_last_contacted',
    'notes_last_updated',
    'notes_next_activity_date',
    'num_contacted_notes',
    'num_notes',
    'hs_sales_email_last_replied',
  ];

  override fromAPI(data: { [key: string]: string | null }): DealData | null {
    if (data['pipeline'] !== config.hubspot.pipeline.mpac) return null;
    return {
      relatedProducts: data['related_products'] || null,
      app: appKey ? data[appKey] as string : null,
      addonLicenseId: data[addonLicenseIdKey],
      transactionId: data[transactionIdKey],
      closeDate: (data['closedate'] as string).substr(0, 10),
      country: data['country'] as string,
      dealName: data['dealname'] as string,
      origin: data['origin'] || null,
      deployment: deploymentKey ? data[deploymentKey] as DealData['deployment'] : null,
      licenseTier: +(data['license_tier'] as string),
      pipeline: enumFromValue(pipelines, data['pipeline']),
      dealstage: enumFromValue(dealstages, data['dealstage'] ?? ''),
      amount: !data['amount'] ? null : +data['amount'],
      hasActivity: (
        isNonBlankString(data['hs_user_ids_of_all_owners']) ||
        isNonBlankString(data['engagements_last_meeting_booked']) ||
        isNonBlankString(data['hs_latest_meeting_activity']) ||
        isNonBlankString(data['notes_last_contacted']) ||
        isNonBlankString(data['notes_last_updated']) ||
        isNonBlankString(data['notes_next_activity_date']) ||
        isNonBlankString(data['hs_sales_email_last_replied']) ||
        isNonZeroNumberString(data['num_contacted_notes']) ||
        isNonZeroNumberString(data['num_notes'])
      ),
    };
  }

  override toAPI: PropertyTransformers<DealData> = {
    relatedProducts: relatedProducts => ['related_products', relatedProducts ?? ''],
    app: EntityManager.upSyncIfConfigured(appKey, app => app ?? ''),
    addonLicenseId: addonLicenseId => [addonLicenseIdKey, addonLicenseId || ''],
    transactionId: transactionId => [transactionIdKey, transactionId || ''],
    closeDate: closeDate => ['closedate', closeDate],
    country: country => ['country', country],
    dealName: dealName => ['dealname', dealName],
    origin: origin => ['origin', origin ?? ''],
    deployment: EntityManager.upSyncIfConfigured(deploymentKey, deployment => deployment ?? ''),
    licenseTier: licenseTier => ['license_tier', licenseTier.toFixed()],
    pipeline: pipeline => ['pipeline', pipelines[pipeline]],
    dealstage: dealstage => ['dealstage', dealstages[dealstage]],
    amount: amount => ['amount', amount?.toString() ?? ''],
    hasActivity: EntityManager.noUpSync,
  };

  override identifiers: (keyof DealData)[] = [
    'addonLicenseId',
    'transactionId',
  ];

  private dealsByAddonLicenseId = this.makeIndex(d => [d.data.addonLicenseId].filter(isPresent));
  private dealsByTransactionId = this.makeIndex(d => [d.data.transactionId].filter(isPresent));

  duplicatesToDelete = new Map<Deal, Set<Deal>>();

  getByAddonLicenseId(id: string) {
    return this.dealsByAddonLicenseId.get(id);
  }

  getByTransactionId(id: string) {
    return this.dealsByTransactionId.get(id);
  }

  getDealsForLicenses(licenses: License[]) {
    return new Set(licenses
      .map(l => this.getByAddonLicenseId(l.data.addonLicenseId))
      .filter(isPresent));
  }

  getDealsForTransactions(transactions: Transaction[]) {
    return new Set(transactions
      .map(tx => this.getByTransactionId(tx.data.transactionId))
      .filter(isPresent));
  }

}

function isNonBlankString(str: string | null) {
  return (str ?? '').length > 0;
}

function isNonZeroNumberString(str: string | null) {
  return +(str ?? '') > 0;
}

function enumFromValue<T extends number>(mapping: Record<T, string>, apiValue: string): T {
  const found = Object.entries(mapping).find(([k, v]) => v === apiValue);
  if (!found) throw new AttachableError('Cannot find ENV-configured mapping:',
    JSON.stringify({ mapping, apiValue }, null, 2));
  return +found[0] as T;
}

const pipelines: Record<Pipeline, string> = {
  [Pipeline.MPAC]: config.hubspot.pipeline.mpac,
};

const dealstages: Record<DealStage, string> = {
  [DealStage.EVAL]: config.hubspot.dealstage.eval,
  [DealStage.CLOSED_WON]: config.hubspot.dealstage.closedWon,
  [DealStage.CLOSED_LOST]: config.hubspot.dealstage.closedLost,
};
