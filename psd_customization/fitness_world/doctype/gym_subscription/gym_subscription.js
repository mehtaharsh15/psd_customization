// Copyright (c) 2018, Libermatic and contributors
// For license information, please see license.txt

frappe.ui.form.on('Gym Subscription', {
  setup: function(frm) {
    if (frm.doc.docstatus !== 1) {
      frm.trigger('set_queries');
    }
  },
  set_queries: async function(frm) {
    const { message: settings = {} } = await frappe.db.get_value(
      'Gym Settings',
      null,
      'default_item_group'
    );
    if (settings['default_item_group']) {
      frm.set_query('item_code', 'service_items', () => ({
        filters: { item_group: settings['default_item_group'] },
      }));
    }
  },
  refresh: function(frm) {
    frappe.ui.form.on('Gym Subscription Item', {
      item_code: function(frm, cdt, cdn) {
        const { item_code, parentfield } = frappe.get_doc(cdt, cdn) || {};
        if (item_code) {
          const { from_date, to_date } = frm.doc;
          if (parentfield === 'service_items' && from_date && to_date) {
            frappe.model.set_value(
              cdt,
              cdn,
              'qty',
              psd_customization.utils.month_diff_dec(from_date, to_date, true)
            );
          } else {
            frappe.model.set_value(cdt, cdn, 'qty', 1);
          }
        } else {
          frappe.model.set_value(cdt, cdn, 'qty', 0);
        }
      },
      qty: async function(frm, cdt, cdn) {
        const { item_code, qty = 0, rate = 0 } = frappe.get_doc(cdt, cdn) || {};
        if (qty) {
          const { member, posting_date: transaction_date } = frm.doc;
          const { message: price } = await frappe.call({
            method:
              'psd_customization.fitness_world.api.gym_subscription.get_item_price',
            args: {
              item_code,
              qty,
              member,
              transaction_date,
              no_pricing_rule: 0,
            },
          });
          frappe.model.set_value(cdt, cdn, 'rate', price);
        } else {
          frappe.model.set_value(cdt, cdn, 'rate', 0);
        }
        frappe.model.set_value(cdt, cdn, 'amount', qty * rate);
      },
      rate: function(frm, cdt, cdn) {
        const { qty = 0, rate = 0 } = frappe.get_doc(cdt, cdn) || {};
        frappe.model.set_value(cdt, cdn, 'amount', qty * rate);
      },
      amount: function(frm) {
        frm.trigger('calculate_total');
      },
      items_remove: function(frm) {
        frm.trigger('calculate_total');
      },
    });
    frm.trigger('add_actions');
    frm.trigger('render_subscription_details');
  },
  member: async function(frm) {
    if (frm.doc['member']) {
      frm.clear_table('membership_items');
      const [
        { message: items = [] },
        { message: dates = {} },
      ] = await Promise.all([
        frappe.call({
          method:
            'psd_customization.fitness_world.api.gym_subscription.get_membership_items',
          args: {
            member: frm.doc['member'],
            transaction_date: frm.doc['posting_date'],
          },
        }),
        frappe.call({
          method:
            'psd_customization.fitness_world.api.gym_subscription.get_next_period',
          args: { member: frm.doc['member'] },
        }),
      ]);
      items.forEach(item => {
        frm.add_child('membership_items', item);
      });
      frm.refresh_field('membership_items');
      frm.set_value('from_date', dates.from_date);
      frm.set_value('to_date', dates.to_date);
      frm.trigger('render_info_html');
    }
    if (frm.doc.docstatus === 0) {
      frm.toggle_display('info_section', !!frm.doc['member']);
    }
  },
  from_date: function(frm) {
    frm.trigger('set_subscription_item_qtys');
  },
  to_date: function(frm) {
    frm.trigger('set_subscription_item_qtys');
  },
  set_subscription_item_qtys: function(frm) {
    const { from_date, to_date } = frm.doc;
    if (from_date && to_date && locals['Gym Subscription Item']) {
      const qty = psd_customization.utils.month_diff_dec(from_date, to_date);
      Object.keys(locals['Gym Subscription Item']).forEach(cdn => {
        const { parentfield } = locals['Gym Subscription Item'][cdn];
        if (parentfield === 'service_items')
          frappe.model.set_value('Gym Subscription Item', cdn, 'qty', qty);
      });
    }
  },
  calculate_total: function(frm) {
    const { items = [] } = frm.doc;
    frm.set_value(
      'total_amount',
      items.reduce((a, { amount: x = 0 }) => a + x, 0)
    );
  },
  add_actions: function(frm) {
    if (frm.doc.docstatus === 1) {
      function get_invoice_props() {
        if (frm.doc['reference_invoice']) {
          return {
            label: 'Make Payment',
            method:
              'psd_customization.fitness_world.api.gym_subscription.make_payment_entry',
          };
        }
        return {
          label: 'Make Invoice',
          method:
            'psd_customization.fitness_world.api.gym_subscription.make_sales_invoice',
        };
      }
      const { label, method } = get_invoice_props();
      frm
        .add_custom_button(label, function() {
          frappe.model.open_mapped_doc({ frm, method });
        })
        .addClass('btn-primary')
        .toggleClass('disabled', frm.doc['status'] === 'Paid');
    }
  },
  render_subscription_details: function(frm) {
    if (frm.doc.__onload && frm.doc.docstatus === 1) {
      function get_color(status) {
        if (status === 'Paid') {
          return 'green';
        }
        if (status === 'Unpaid') {
          return 'orange';
        }
        if (status === 'Overdue') {
          return 'red';
        }
        return 'blue';
      }
      const { si_value, si_status } = frm.doc.__onload;
      const html = frappe.render_template('gym_subscription_dashboard', {
        amount: format_currency(
          si_value,
          frappe.defaults.get_default('currency')
        ),
        color: get_color(si_status),
      });
      frm.dashboard.show();
      frm.dashboard.add_section(html);
    }
  },
});
