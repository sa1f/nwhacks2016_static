'use strict';
const categories = ['applied', 'accepted', 'waitlisted', 'rejected'];
Object.freeze(categories);
const responseCategories = ['no response', 'going', 'not going', 'need reimbursement'];
Object.freeze(responseCategories);
Polymer({
  is: "select-hackers",

  properties: {
    hackers: {
      type: Array,
      value: [],
    },
    incr: {
      type: Number,
      value: 0,
    },
    categories: {
      type: Array,
      value: categories,
    },
    filters: {
      type: Object,
      value: function(){return {
        search: '',
        status: '',
        response: '',
      }; },
    },
    responseCategories: {
      type:Array,
      value: responseCategories,
    },
  },
  refresh: function() {
    this.incr++;
  },
  attached: function() {
    var self = this;
    setTimeout(function() {
      self.resize();
    }, 100);
    window.addEventListener("resize", function() {
      self.resize();
    });
  },
  resize: function() {
    var top = this.$.list.getBoundingClientRect().top;
    this.$.list.style.height = window.innerHeight - top + 'px';
  },
  observers: [
    'hackersChange(hackers)',
    'refresh(filters.status)',
    'refresh(filters.checked_in)',
    'refresh(filters.response)',
    'refresh(filters.search)',
    'refresh(filters.mentor)',
    'refresh(filters.first)',
    'refresh(filters.reimbursement)',
  ],
  handleResponse: function(e, req) {
    var hackers = req.xhr.response;
    hackers.sort(function(a, b) {
      return a.id - b.id;
    });
    var dedup = {};
    hackers.forEach(function(hacker) {
      var email = hacker.email.toLowerCase().trim();
      dedup[email] = (dedup[email] || 0) + 1;
    });
    hackers.forEach(function(hacker) {
      var email = hacker.email.toLowerCase().trim();
      if (dedup[email] > 1) {
        hacker.duplicate = true;
      }
    });
    this.hackers = hackers;
  },
  cleanEmail: function(email) {
  },
  responseCat: function(i) {
    return this.responseCategories[i];
  },
  eq: function(a, b) {
    return a == b;
  },
  export: function() {
    var csv = new CSV(this.filtered, { header: true }).encode();
    this.downloadFile("applicants_export.csv", csv);
  },
  downloadFile: function(filename, content) {
    var blob = new Blob([content]);
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent("click");
    $("<a>", {
      download: filename,
      href: webkitURL.createObjectURL(blob)
    }).get(0).dispatchEvent(evt);
  },
  hackersChange: function(hackers) {
    this.lunr = lunr(function () {
      this.ref('index');
      this.field('city');
      this.field('email');
      this.field('emailSplit');
      this.field('github');
      this.field('personalsite');
      this.field('linkedin');
      this.field('name');
      this.field('reason');
      this.field('school')
    });
    var self = this;
    $.each(hackers, function(i, hacker) {
      var lowerSchool = hacker.school.toLowerCase();
      if (lowerSchool.indexOf('secondary') >= 0 || lowerSchool.indexOf('high') >= 0) {
        hacker.hs = true;
      }
      if (!hacker.status) {
        hacker.status = 'applied';
      } else {
        hacker.status = categories[hacker.status];
      }
      hacker.index = i;
      hacker.emailSplit = hacker.email.replace(/@/g, ' ');
      self.lunr.add(hacker);
    });
  },
  title: function(hacker) {
    return hacker.name + ' ('+hacker.email+')';
  },
  filter: function(hackers, filters, _) {
    var results = hackers;
    this.totalCount = hackers.length;
    if (filters.search.length > 0) {
      var rawResults = this.lunr.search(filters.search);
      results = rawResults.map(function(result) {
        return hackers[result.ref];
      });
    }
    var status = filters.status;
    var response = filters.response;
    var responseIdx = this.responded(response);
    var filtered = results.filter(function(hacker, b, c) {
      var good = (status === '' || status === 'null' || status === 'All' || status === hacker.status) &&
        (response === '' || response === 'null' || response === 'All' || hacker.acceptance_sent && responseIdx === hacker.response);
      if (filters.mentor) {
        good = good && hacker.mentor;
      }
      if (filters.checked_in) {
        good = good && hacker.checked_in;
      }
      if (filters.reimbursement) {
        good = good && hacker.travel_reimbursement;
      }
      if (filters.first) {
        good = good && hacker.first_hackathon;
      }
      return good
    });
    this.filtered = filtered;
    this.filteredCount = filtered.length;
    console.log('filtered', filtered);
    return filtered;
  },
  githubLink: function(username) {
    if (username.indexOf('github.com') > 0) {
      return username;
    }
    return 'https://github.com/' + username;
  },
  linkedinLink: function(username) {
    if (username.indexOf('linkedin.com') > 0) {
      return username;
    }
    return 'https://linkedin.com/in/' + username;
  },
  selected: function(status) {
    var index = categories.indexOf(status);
    if (index >= 0) {
      return index;
    }
    return 0;
  },
  responded: function(status) {
    var index = responseCategories.indexOf(status);
    if (index >= 0) {
      return index;
    }
    return 0;
  },
  eq: function(a, b) {
    return a === b;
  },
  respondedWith: function(hacker, response) {
    console.log(hacker.response, response);
    return hacker.acceptance_sent && hacker.response === response;
  },
  onSelect: function(e) {
    var index = e.target.selectedIndex;
    var status = categories[index];
    var hacker = e.model.hacker;
    if (hacker.status !== status) {
      this.set('hackers.'+hacker.index+'.status',status);
      this.patchHacker(hacker, {
        status: categories.indexOf(hacker.status),
      });
    }
  },
  phoneChange: function(e) {
    var hacker = e.model.hacker;
    this.patchHacker(hacker, {
      phone: hacker.phone,
    });
  },
  checkIn: function(e) {
    var hacker = e.model.hacker;
    this.patchHacker(hacker, {
      checked_in: hacker.checked_in,
    });
  },
  patchHacker: function(hacker, data) {
    $.ajax({
      url : '/api/register/'+hacker.id+'/',
      type : 'PATCH',
      data : data,
    }).done(function(e) {
      console.log('done', e);
    }).fail(function(e) {
      console.log('error', e);
      alert("error", e);
    });
  },
  refreshList: function() {
    this.incr++;
  },
  handleErr: function(a,b,c) {
    alert(b.error + "\n\nYou may need to login at:\nhttps://www.nwhacks.io/api/admin/");
  },
  hackerAdminURL: function(hacker) {
    return '/api/admin/nwhacks/registration/'+hacker.id+'/change/';
  },
});
