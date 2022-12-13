import MessageAPI from './MessageAPI';
import CaseThreadAPI from './ThreadAPI';

const messageapi = new MessageAPI();
const caseapi = new CaseThreadAPI();

function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

$(function () {

    var $modal = $("#modal").modal();
    var csrftoken = getCookie('csrftoken');

    /*get new, unread messages */
    messageapi.getUnreadMessageCount().then(response => {
	if (response.unread > 0) {
	    let unread_count = parseInt(response.unread);
	    $("#unread_msg_badge").html(`<span class=\"badge badge-center rounded-pill bg-success\">${unread_count}</span>`);
	}
    });

    caseapi.getCaseNotifications().then(response => {
	if (response.length) {
	    
	    $("#notify_count").html(`<span class=\"badge rounded-pill bg-danger\">${response.length}</span>`);
	    var notifications = "";
	    response.map((r, index) => {
		notifications = notifications + `<li>
			<a class="dropdown-item" href="${r.url}">${r.text}</a></li>`;
		if (index != response.length) {
		    notifications + '<li><div class="dropdown-divider"></div></li>';
		}
	    });
	    $("#notify_list").html(notifications);
	}
    });
    
    /* scroll side button */

    
    $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
            $('.scrollup').fadeIn();
        } else {
            $('.scrollup').fadeOut();
        }
	});
    
    $('.scrollup').click(function () {
        $("html, body").animate({
            scrollTop: 0
        }, 600);
        return false;
    });
    
});
