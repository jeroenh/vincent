import React,  { useRef, useState, useEffect }  from 'react';
import {Row, Card, Alert, Col, Button, OverlayTrigger, Tooltip} from "react-bootstrap";
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid' // a plugin!
import timeGridPlugin from "@fullcalendar/timegrid";
import { formatDate } from '@fullcalendar/core'
import interactionPlugin, {Draggable} from '@fullcalendar/interaction'
import ChangeEventModal from './ChangeEventModal.js';
import {useParams, useNavigate, Link, useLocation, useSearchParams} from "react-router"
import AdminAPI from 'Components/AdminAPI';

const adminapi = new AdminAPI();

let todayStr = new Date().toISOString().replace(/T.*$/, '') // YYYY-MM-DD of today

export const CALENDAR_EVENTS = [
  {
      id: 1,
      title: 'Triage',
      color: "#005288",
  },
    {
	id: 2,
	title: 'Out of Office',
	color: "#C41230"
  }
]


export default function TriageCalendar() {

    const location = useLocation();
    const navigate = useNavigate();
    let [searchParams, setSearchParams] = useSearchParams();
    const [weekendsVisible, setWeekendsVisible] = useState(true);
    const [events, setEvents] = useState([]);
    const [triageTeam, setTriageTeam]=useState(location.state?.team || searchParams.get('team', null));
    const [showChangeEvent, setShowChangeEvent] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [error, setError] = useState(null);
    const [users, setUsers] = useState(location.state?.users);


    const CalSidebar = ({ weekendsVisible, handleWeekendsToggle, currentEvents }) => {

	const externalEventsRef = useRef(null);


	useEffect(() => {
            if (externalEventsRef.current) {
		new Draggable(externalEventsRef.current, {
		    itemSelector: '.fc-event-draggable',
		    eventData: function(eventEl) {
			console.log(eventEl);
			var color = "#005288";
			if (eventEl.classList.contains("oof_event")) {
			    color = "#C41230";
			}
			return {
			    title: eventEl.innerText,
			    duration: '24:00',
			    color: color

			};
		    },
		});
            }
	}, []);


	return (
	    <div className='demo-app-sidebar'>
		<div id="external-events">
		    <h4>Events</h4>
		    <div id='external-events-list' ref={externalEventsRef}>
			<div className='p-2 my-2 fc-event-draggable fc-h-event fc-daygrid-event fc-daygrid-block-event oof_event'>
			    <div className='fc-event-main oof'>Out of Office</div>
			</div>
			<div className='p-2 my-2 fc-event-draggable fc-h-event fc-daygrid-event fc-daygrid-block-event triage_event'>
			    <div className='fc-event-main triage'>Triage</div>
			</div>
		    </div>
		</div>

		<div className='demo-app-sidebar-section'>
		    <label>
			<input
			    type='checkbox'
			    checked={weekendsVisible}
			    onChange={handleWeekendsToggle}
			></input>
			{" "}toggle weekends
		    </label>
		</div>
	    </div>
	)
  }



    // Async Fetch                                                                                                     
    const fetchInitialData = async () => {
        console.log("fetching data");
	console.log(triageTeam);

        await adminapi.getCalendarMeta({team: triageTeam}).then((response) => {
            setUsers(response.users);
	    setTriageTeam(response.group.name);
	    window.history.pushState({}, '', `?team=${response.group.name}`);
        }).catch(err => {
	    if (err.response?.status == 403) {
		navigate("err");
	    } else {
		setError(`${err.message}: ${err.response?.data?.error}`);
	    }
        });

    }

    useEffect(() => {
        if (searchParams.get('team')) {
            setTriageTeam(searchParams.get('team'));
	    fetchInitialData();
        }
    }, [searchParams]);


    const hideChangeEvent = () => {
	setShowChangeEvent(false);
    }

    const removeEvent = async(event) => {

	await adminapi.removeCalendarEvent(event).then(response => {
	    selectedEvent.remove()
	    

	}).catch(err => {
	    console.log(err);
	});
    }
    

    const submitEvent = async(event, eventObj) => {

	if (event.remove) {
	    removeEvent(event.remove);
	    return;
	}

	if (event.assign_user && event.newevent == false) {
	    await adminapi.updateCalendarEvent(selectedEvent.id, event).then((response) => {
		selectedEvent.setExtendedProp('user', response.user)
		selectedEvent.setProp('title', response.title)
		selectedEvent.setExtendedProp('event_id', response.event_id)
		if (response.event_id == CALENDAR_EVENTS[0].id) {
		    selectedEvent.setProp('color', CALENDAR_EVENTS[0].color);
		} else {
		    selectedEvent.setProp('color', CALENDAR_EVENTS[1].color);
		}
            }).catch(err => {
		setError(`${err.message}: ${err.response?.data?.error}`);
            });
	    return;
	}

	await adminapi.createCalendarEvent(event).then((response) => {
	    if (events.some(x => x.id == response.id)) {
		/* this event already exists */
		eventObj.remove();
	    } else {
		eventObj.setProp('id', response.id)
		eventObj.setExtendedProp('user', response.user);
		eventObj.setExtendedProp('event_id', response.event_id)
                if (response.event_id == CALENDAR_EVENTS[0].id) {
                    eventObj.setProp('color', CALENDAR_EVENTS[0].color);
                } else {
                    eventObj.setProp('color', CALENDAR_EVENTS[1].color);
		    eventObj.setProp('title', CALENDAR_EVENTS[1].title);
                }
		setEvents([...events, response]);
	    }
	}).catch(err => {
	    eventObj.remove();
	    console.log(err);
	    setError(`${err.message}: ${err.response?.data?.error}`);
	});

    }

    const changeEvent = async(event) => {

	if (!event.event.endStr) {
	    return;
	}
	
	let data = {'date': event.event.startStr.slice(0, 10)}
	if (event.event.endStr) {
	    data['end'] = event.event.endStr;
	}
	await adminapi.updateCalendarEvent(event.event.id, data).then((response) => {
            console.log(response);
        }).catch(err => {
	    setError(`${err.message}: ${err.response?.data?.error}`);
        });
    }
	
    
    const handleEventReceive = (eventInfo) => {

	var objname = eventInfo.draggedEl?.getAttribute('class') || "";
	
        var event_id = '1';
        if (objname.includes('oof')) {
            event_id = '2';
        }
	var date = eventInfo.event.startStr.slice(0, 10);
	let data = {date: date, event_id: event_id, coord_team: triageTeam}

	submitEvent(data, eventInfo.event);

    };

    const handleWeekendsToggle = () => {
	setWeekendsVisible(!weekendsVisible);
    }

    const handleDateSelect = (selectInfo) => {

	let title = CALENDAR_EVENTS[0].title; 
	let calendarApi = selectInfo.view.calendar

	calendarApi.unselect() // clear date selection

	let newEvent = calendarApi.addEvent({
	    event_id: CALENDAR_EVENTS[0].id,
	    color: CALENDAR_EVENTS[0].color,
	    title,
	    start: selectInfo.startStr.slice(0, 10),
	    end: "",
	    allDay: selectInfo.allDay
	})
	
	setSelectedEvent(newEvent);
	setShowChangeEvent(true);
	

	//submitEvent({date: selectInfo.startStr.slice(0, 10), event_id: CALENDAR_EVENTS[0].id}, newEvent);

	
	
    }

    const handleEventClick = (clickInfo) => {

	setSelectedEvent(clickInfo.event);
	setShowChangeEvent(true);
	/*
	if (confirm(`Are you sure you want to delete the event '${clickInfo.event.title}'`)) {
	    clickInfo.event.remove()
	    }
	*/
    }

    const handleEvents = (events) => {
	console.log("SET EVENTS!!!");
	console.log(events);
	setEvents(events);
    }

    useEffect(() => {
        fetchInitialData();
	document.title = `VINCE-NT Triage Calendar`;
    }, []);
    
    function renderEventContent(eventInfo) {
	return (
	    <>
		<b>{eventInfo.event.extendedProps.user}</b><br/>
		<i>{eventInfo.event.title}</i>
	    </>
	)
    }

    return (
	<>
            <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light"><Link to={"/cvdp/triage/"}>Triage</Link> /</span> Triage Calendar</h4>
	    <Row>
	    <Col lg={12}>
		<Card>
		    <Card.Header>
			<Card.Title>
			    <h3>{triageTeam} Triage Calendar {" "}
				<OverlayTrigger
				    placement="left"
				    overlay={
					<Tooltip>
					    <ul>
						<li>Drag Out of Office or Triage events onto desired date.</li>
						<li>Or select dates and you will be prompted to create a new event</li>
						<li>Drag, drop, and resize events</li>
						<li>Click an event to delete it</li>
					    </ul>
					    
					</Tooltip>
				    }
        			>
				<i className="fas fa-info-circle"></i></OverlayTrigger>
				
			    </h3>
			</Card.Title>
		    </Card.Header>
		    <Card.Body>
			{error &&
			 <Row>
			     <Col lg={12}>
				 <Alert variant="danger">{error}</Alert>
			     </Col>
			 </Row>
			}
			<Row>
			    
			    <Col lg={10}>
				<ChangeEventModal
				    showModal={showChangeEvent}
				    hideModal={hideChangeEvent}
				    confirmModal={submitEvent}
				    users={users ? users : []}
				    event={selectedEvent}
				/>
				<FullCalendar
				    plugins={[ dayGridPlugin, timeGridPlugin,interactionPlugin ]}
				    events={adminapi.getCalendarEventsUrl({team: triageTeam})}
				    initialView="dayGridMonth"
				    headerToolbar ={ {
					left: 'prev,next today',
					center: 'title',
					right: "dayGridMonth,timeGridWeek,timeGridDay"
				    }}
				    timezone='local'
				    editable={true}
				    droppable={true}
				    selectable={true}
				    selectMirror={true}
				    dayMaxEvents={true}
				    weekends={weekendsVisible}
				    select={handleDateSelect}
				    eventChange={changeEvent}
				    eventContent={renderEventContent} // custom render function
				    eventClick={handleEventClick}
				    eventReceive={handleEventReceive}
				    //eventAdd={handleEventReceive}
				    eventsSet={handleEvents}
				/>
			    </Col>
	    		    <Col lg={2}>
				<CalSidebar
				    weekendsVisible={weekendsVisible}
				    handleWeekendsToggle={handleWeekendsToggle}
				    currentEvents={events}
				/>
			    </Col>
			    
			</Row>
		    </Card.Body>
		</Card>
	    </Col>
	    </Row>
	</>
    )
}
