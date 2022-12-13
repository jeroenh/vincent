import React, { useState, useRef, useEffect, useMemo } from 'react';
import InboxApp from './InboxApp.js'
import {Alert, Badge, Tab, Tabs} from 'react-bootstrap';
import MessageAPI from './MessageAPI';
import ContactAPI from './ContactAPI';
import {useLocation} from 'react-router';

const contactapi = new ContactAPI();
const messageapi = new MessageAPI();

const LoadInboxApp = (props) => {

    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const [groupThreads, setGroupThreads] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('activeTab') || "user");
    
    const fetchInitialData = async () => {


	try {
	    contactapi.getMyGroups().then((response) => {
		setGroupThreads(response);
	    });
	    
	    messageapi.getUnreadMessageCount().then(response => {
		setUnreadCounts(response);
		setLoading(false);
		
	    });

	} catch(err) {
	    console.log(err);
	    setError(err);
	}
    }


    const updateUnreadCount = async () => {

	await messageapi.getUnreadMessageCount().then(response => {
            setUnreadCounts(response);
	    console.log(response);
        }).catch(err => {
	    console.log("unable to get unread count");
	    console.log(err);
	});
    }

    
    useEffect(()=> {
	fetchInitialData();
    }, [])

    useEffect(() => {
	if (props.message) {
	    if (groupThreads.length > 0) {
		if (document.getElementById('activetab')) {
		    setActiveTab(document.getElementById('activetab').getAttribute('val'));
		    
		} 
	    }
	}
    }, [groupThreads]);

    const setActiveTabNow = (props) => {
        window.history.pushState({}, '', `?activeTab=${props}`);
        setActiveTab(props);
    }
    
    return (
	<>
	    {loading ?
	     <div>
		 <p>Loading ....</p>
		 <>
		     {error &&
		      <Alert variant="danger">{error}</Alert>
		     }
		 </>
	     </div>
	     :
	     
	     <>
		 {groupThreads.length > 0 ?
		  <Tabs
		      id="inboxapp"
		      defaultActiveKey="user"
		      activeKey = {activeTab}
		      onSelect = {setActiveTabNow}
		  >
		      <Tab eventKey="user" title={unreadCounts['user'] ? <>My Inbox <Badge pill bg="success">{unreadCounts['user']}</Badge></> : "My Inbox"}>
			  <InboxApp
			      coord={props.coord}
			      contactmsg={props.contactmsg}
			      message = {props.message}
			      update = {updateUnreadCount}
			  />
		      </Tab>
		      {groupThreads.map((gt, index) => {
			  let unread = unreadCounts[gt.uuid];
			  return (
			      <Tab eventKey={gt.uuid} key={`${gt.name}-${index}`} title={unread ? <>{gt.name} <Badge pill bg="success">{unread}</Badge></> : gt.name}>
				  {activeTab == gt.uuid &&
				   <InboxApp
				       coord={props.coord}
				       contactmsg={props.contactmsg}
				       group = {gt}
				       message = {props.message}
				       update = {updateUnreadCount}
				   />
				  }
			      </Tab>
			  )
		      })}
		  </Tabs>
		  :
		  <InboxApp
		      coord={props.coord}
		      contactmsg={props.contactmsg}
		      message={props.message}
		      update = {updateUnreadCount}
		  />
		 }
	     </>
	    }
	</>
    )
}
export default LoadInboxApp;
