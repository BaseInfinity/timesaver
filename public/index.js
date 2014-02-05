$(window).load(function(){  
  var lunchButton = $('#lunchHoursButton');
  var regularHours = $('#regularHoursInput');
  var overtimeHours = $('#overtimeHoursInput');
  var makeupHours = $('#makeupHoursInput');

  var enableLunchButton = function(element, enable) {
    if (enable) {
      element.removeClass('btn-danger');
      element.addClass('btn-success');
      element.html('Lunch Taken');
      element.data('lunchtaken', true);
    } else {
      element.removeClass('btn-success');
      element.addClass('btn-danger');
      element.html('Lunch Not Taken');
      element.data('lunchtaken', false);
    }
  };

  lunchButton.click(function() {
    var element = $(this);
    element.button('loading');

    $.ajax({
      type: 'POST',
      url: '/lunch',
      data: JSON.stringify({
        lunchTaken : !element.data('lunchtaken')
      }),
      contentType: 'application/json',
      beforeSend: function() {
        console.log('lunch taken?');
        console.log(element.data('lunchtaken'));
      },
      success: function(data) {
        if (data.success) {
          element.button('reset');
          enableLunchButton(element, data.lunchTaken);
        }
      }
    });
  });

  $('.form-control').on('input', function() {
    if ($(this).val() === '' || $(this).val().length > 5 || $(this).val().match(/[^0-9.]/))
      return;

    var element = $(this);
    element.parent().removeClass('has-success');
    element.tooltip('hide');

    $.ajax({
      type: 'POST',
      url: '/hours',
      data: JSON.stringify({
        type: element.attr('hoursType'),
        value: element.val()
      }),
      contentType: 'application/json',
      beforeSend: function() {
        console.log('about to send change');
      },
      success: function(data) {
        console.log(data);
        element.parent().addClass('has-success');
        element.tooltip('show');
        setTimeout(function() {
          element.tooltip('hide');
          element.parent().removeClass('has-success');
        }, 2000);
      }
    });
  });
});
