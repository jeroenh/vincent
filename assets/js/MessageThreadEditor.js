import React, { useState, useRef, useEffect, useMemo } from 'react';
import {Nav, Dropdown, DropdownButton, InputGroup, CardGroup, Alert, Button, Tab, Tabs, Row, Form, Card, Col} from 'react-bootstrap';
import MessageAPI from './MessageAPI';
import NewMessage from './NewMessage';
import MessageThreadHeader from './MessageThreadHeader';
import MessageList from './MessageList';
import SendMessageApp from './SendMessageApp';
import PerfectScrollbar from "react-perfect-scrollbar";
import "react-perfect-scrollbar/dist/css/styles.css";

import { format, formatDistance } from 'date-fns'

const messageapi = new MessageAPI();

const MessageThreadEditor = (props) => {

    const [isLoading, setIsLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(null);
    const [thread, setThread] = useState(null);
    const scrollbarRef = useRef(null);
    
    const fetchInitialData = async (t) => {

	console.log("FETCHING!!!");
	await messageapi.getThreadDetail(t).then((response) => {
	    setThread(response);
	    setIsLoading(false);
	}).catch(err => {
	    setError("Unable to retrieve details for messsage thread");
	});
	
	await messageapi.getMessages({'id': t }).then((response) => {
            setMessages(response);
        }).catch(err => {
            setError("Error retrieving messages for this thread.");
            console.log(err);
        });
    }

    useEffect(() => {

	console.log(props);
	
	if (props.thread) {
	    fetchInitialData(props.thread);
	}


    }, [props.thread]);
    

    const updateMessages = (msg) => {
        setMessages((messages) => [...messages, msg]);
    }

    useEffect(() => {

	if (messages.length > 0) {
	    if (scrollbarRef.current) {
		// Access the actual container element via the ref and set scrollTop
		const container = scrollbarRef.current._container; // The actual DOM element
		container.scrollTop = container.scrollHeight;
	    }
	}
	

    }, [messages]);
    
    return (

	<>
	    {isLoading ?
	     <div className="text-center">                                                                               
                 <div className="lds-spinner"><div></div><div></div><div></div></div>                                    
             </div>  
	     
	     :
	     <>
		 
		 {thread &&
		  <div className="thread-messages">
		      <MessageThreadHeader
			  thread={thread}
		      />

		      <PerfectScrollbar
                          style={{
                              position: "relative",
                              height: "auto",
                          }}
                          className="chat-scrollbar mb-1"
                          ref={scrollbarRef}
                          title="Scroll Thread Messages"
		     >                   
			  {messages.length > 0 &&
			   <MessageList
			       messages={messages}
			   />
			  }
		      </PerfectScrollbar>
		      <SendMessageApp
			  thread = {thread.id}
			  messageSent = {updateMessages}
		     />
		  </div>
		 }
	     </>
	    }
	</>
    )


}

export default MessageThreadEditor;
