"use strict";

var Twix   = require('twix/bin/twix'),
    moment = require('moment');

// for when https://github.com/icambron/twix.js/pull/2 applied
// var Twix = require('twix');


// bit of a hack - returns a date string that is correct in the UTC timezone.
// Can then be interpreted in twix as local time and still return correct date.
var toUTCDate = function (in_date) {

  var date_obj = new Date(in_date);

  var yyyy = date_obj.getUTCFullYear();
  var mm   = date_obj.getUTCMonth() + 1;
  var dd   = date_obj.getUTCDate();

  return yyyy + '/' + mm + '/' + dd;  
};

var partialDateFormat = module.exports.format = function (start,end) {

  var twix = new Twix(
    toUTCDate(start),
    toUTCDate(end),
    true                      // all day event - don't show the times
  );

  return twix.format({
    implicitYear: false, // Always show the year, even if it is the current one
  });
  
};

module.exports.plugin = function partialDatePlugin (schema, options) {

  var fieldName = options.fieldName;
  

  var args = {};
  args[fieldName] = {
    start:     { type: Date,   default: null, },
    end:       { type: Date,   default: null, },
  };

  schema.add(args);
  
  schema.virtual(fieldName + '.formatted').get(function() {
    
    var start = this.get(fieldName + '.start');
    var end   = this.get(fieldName + '.end');
    
    return partialDateFormat( start, end );
  });
  
  schema.set( 'toJSON', { virtuals: true } );

  // schema.set('toJSON', {});
  // schema.options.toJSON.transform = function (doc, ret, options) {
  //   console.log(ret);
  // };
  
  // if we have just a start time use it to populate the end time
  // schema.pre('validate', function (next) {
  //   if ( ! this.get(fieldName).end ) {
  //     this.set(fieldName + '.end', this.get(fieldName).start);
  //   } 
  //   next();
  // });

  // Validators. Check that we have both, or neither, of start and end. Check that
  // start <= end.

  // return true if both are true, or both are false
  function both_or_neither (dates) {
    if ( !dates )                   return false;
    if ( dates.start && dates.end ) return true;
    if ( dates.start || dates.end ) return false;
    return true;
  }

  schema
    .path(fieldName + '.end')
    .validate(
      function (value) {
        return both_or_neither( this.get(fieldName) );          
      },
      "start date is missing"
    );
  schema
    .path(fieldName + '.start')
    .validate(
      function (value) {
        return both_or_neither( this.get(fieldName) );          
      },
      "end date is missing"
    );
  schema
    .path(fieldName + '.start')
    .validate(
      function (value) {
        if (!this.get(fieldName)) return false;
        return this.get(fieldName).start <= this.get(fieldName).end;
      },
      "start date is after end date"
    );

};

function cleanse_date_string (string) {
  var parsed = moment(string); // be loose, could add the "YYYY-MM-DD" format to be stricter
  if ( parsed && parsed.isValid() ) {
    // Force UTC as we are only interested in the date, not the time.
    return parsed.format('YYYY-MM-DD UTC');
  } else {
    return '';
  }
  
}

module.exports.parser = function partialDateParser ( date_string ) {

  var parts        = date_string.split(/\s+to\s+/);
  var start_string = parts[0] || '';
  var end_string   = parts[1] || start_string;
    
  var result = {
    start: cleanse_date_string(start_string),
    end:   cleanse_date_string(end_string),
  };
  
  if ( ! result.end ) result.start = '';
 
  return result;
};

