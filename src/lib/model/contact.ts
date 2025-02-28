import env from "../parameters/env.js";
import { Company } from "./company.js";
import { Entity } from "./hubspot/entity.js";
import { EntityKind } from "./hubspot/interfaces.js";
import { EntityAdapter, EntityManager } from "./hubspot/manager.js";

export type ContactType = 'Partner' | 'Customer';

export type ContactData = {
  readonly email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;

  contactType: ContactType | null;

  country: string | null;
  region: string | null;

  products: Set<string>;
  deployment: 'Cloud' | 'Data Center' | 'Server' | 'Multiple' | null;

  relatedProducts: Set<string>;
  licenseTier: number | null;
  lastMpacEvent: string | null;
};

type ContactComputed = {
  readonly otherEmails: readonly string[];
};

export class Contact extends Entity<ContactData, ContactComputed> {

  companies = this.makeDynamicAssociation<Company>('company');

  get isExternal() { return !this.data.email || !this.data.contactType; }

  get allEmails() { return [this.data.email, ...this.computed.otherEmails]; }
  get isPartner() { return this.data.contactType === 'Partner'; }
  get isCustomer() { return this.data.contactType === 'Customer'; }

}

const ContactAdapter: EntityAdapter<ContactData, ContactComputed> = {

  associations: [
    ['company', 'down/up'],
  ],

  data: {
    contactType: {
      property: env.hubspot.attrs.contact.contactType,
      down: contact_type => contact_type as ContactType,
      up: contactType => contactType ?? '',
    },

    email: {
      property: 'email',
      identifier: true,
      down: email => email ?? '',
      up: email => email,
    },
    country: {
      property: 'country',
      down: country => country,
      up: country => country ?? '',
    },
    region: {
      property: env.hubspot.attrs.contact.region,
      down: region => region,
      up: region => region ?? '',
    },

    firstName: {
      property: 'firstname',
      down: firstname => firstname?.trim() || null,
      up: firstName => firstName?.trim() || '',
    },
    lastName: {
      property: 'lastname',
      down: lastname => lastname?.trim() || null,
      up: lastName => lastName?.trim() || '',
    },
    phone: {
      property: 'phone',
      down: phone => phone?.trim() || null,
      up: phone => phone?.trim() || '',
    },
    city: {
      property: 'city',
      down: city => city?.trim() || null,
      up: city => city?.trim() || '',
    },
    state: {
      property: 'state',
      down: state => state?.trim() || null,
      up: state => state?.trim() || '',
    },

    relatedProducts: {
      property: env.hubspot.attrs.contact.relatedProducts,
      down: related_products => new Set(related_products ? related_products.split(';') : []),
      up: relatedProducts => [...relatedProducts].join(';'),
    },
    licenseTier: {
      property: env.hubspot.attrs.contact.licenseTier,
      down: licenseTier => licenseTier ? +licenseTier.trim() : null,
      up: licenseTier => licenseTier?.toFixed() ?? '',
    },
    deployment: {
      property: env.hubspot.attrs.contact.deployment,
      down: deployment => deployment as ContactData['deployment'] ?? null,
      up: deployment => deployment ?? '',
    },
    products: {
      property: env.hubspot.attrs.contact.products,
      down: products => new Set(products?.split(';') || []),
      up: products => [...products].join(';'),
    },
    lastMpacEvent: {
      property: env.hubspot.attrs.contact.lastMpacEvent,
      down: last_mpac_event => last_mpac_event,
      up: lastMpacEvent => lastMpacEvent ?? '',
    },
  },

  computed: {
    otherEmails: {
      default: [],
      down: data => data['hs_additional_emails']?.split(';') || [],
      properties: ['hs_additional_emails'],
    },
  },

};

export class ContactManager extends EntityManager<ContactData, ContactComputed, Contact> {

  override Entity = Contact;
  override kind: EntityKind = 'contact';
  override entityAdapter = ContactAdapter;

  public getByEmail = this.makeIndex(c => c.allEmails, ['email']);

}
