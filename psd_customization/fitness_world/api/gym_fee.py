# -*- coding: utf-8 -*-
# Copyright (c) 2018, Libermatic and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.utils import add_days, cint, getdate
from functools import partial
from toolz import get, compose, first, merge

from psd_customization.fitness_world.api.gym_membership import get_end_date
from psd_customization.utils.fp import pick


@frappe.whitelist()
def get_next_from_date(membership):
    existing_fees = frappe.db.sql(
        """
            SELECT to_date
            FROM `tabGym Fee`
            WHERE
                docstatus = 1 AND
                membership = '{membership}'
            ORDER BY to_date DESC
            LIMIT 1
        """.format(membership=membership),
        as_dict=True,
    )
    if existing_fees:
        return compose(
            partial(add_days, days=1),
            getdate,
            partial(get, 'to_date'),
            first,
        )(existing_fees)
    membership_start_date = frappe.get_value(
        'Gym Membership', membership, 'start_date',
    )
    return membership_start_date


@frappe.whitelist()
def get_to_date(membership, from_date, duration):
    frequency = frappe.db.get_value(
        'Gym Membership', membership, 'frequency'
    )
    return get_end_date(from_date, frequency, times=cint(duration))


@frappe.whitelist()
def get_items(membership, duration):
    def update_amounts(row):
        return merge(
            pick(
                ['item_code', 'item_name', 'qty', 'rate', 'amount'],
                row.as_dict()
            ),
            {
                'qty': row.qty * cint(duration),
                'amount': row.amount * cint(duration),
            },
        )
    doc = frappe.get_doc('Gym Membership', membership)
    return map(update_amounts, doc.items)
