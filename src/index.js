import Vue from 'vue';

import TrainingSchedule from './TrainingSchedule.vue';
import MemberDashboard from './MemberDashboard.vue';
import components from './frappe-components';

export default {
  make_member_dashboard: (node, props) =>
    new Vue({
      el: node,
      render: h => h(MemberDashboard, { props }),
    }),
  make_training_schedule_page: node =>
    new Vue({
      el: node,
      render: h => h(TrainingSchedule),
    }),
  components,
};
