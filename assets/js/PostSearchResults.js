import React from 'react';
import ReactDOM from "react-dom";
import CaseThreadAPI from './ThreadAPI';
import { useState, useEffect, useCallback } from 'react';
import {Card, DropdownButton, Dropdown, InputGroup, FloatingLabel, Form, Container, Alert, Row, Col, Tab, Tabs, Nav, Button} from 'react-bootstrap';
import {useModalManager} from "./hooks/useModalManager";
import SimplePost from './SimplePost';
import ErrorModal from './ErrorModal';


const threadapi = new CaseThreadAPI();

export default function PostSearchResults(props) {

    const { openModal, closeModal, currentModal } = useModalManager();
    const [isLoading, setIsLoading] = useState(false);
    const [posts, setPosts] = useState([]);
    const [search, setSearch] = useState("");
    const [toggle, setToggle] = useState("lifo");
    const [errorMessage, setErrorMessage] = useState(null);
    const [drfError, setDRFError] = useState(null);
    
    const fetchPosts = async () => {

	await threadapi.searchThreads(props.caseInfo.case_id, encodeURIComponent(props.search.value)).then((response) => {
	    if (toggle == "fifo") {
		setPosts(response.reverse());
	    } else {
		setPosts(response);
	    }
	    setIsLoading(false);

	}).catch(err => {

            if (err.response?.status == 400) {
                setDRFError(err.response.data);
            } else {
                setErrorMessage(`Error searching threads: ${err.message}.`);
            }
	    openModal("error");
	    setIsLoading(false);
	    console.log(err);
	});

    }

    // Function to reverse a given array
    const reverseArray = (array) => {
        var reverseArray = array.reverse();
        return reverseArray;
    }

    useEffect(() => {
	if (props.search) {
	    if (props.search.value != search) {
		setIsLoading(true);
		setSearch(props.search.value);
		fetchPosts();
	    }
	    if (props.search.toggle != toggle) {
		setToggle(props.search.toggle);
		setPosts(reverseArray([...posts]));
	    }

	}

    }, [props.search]);


    return (
	<>
	    {isLoading ? (
		<div className="text-center">
                    <div className="lds-spinner"><div></div><div></div><div></div></div>
		</div>
            ) : (
		<>
		    <div className="d-flex justify-content-between align-items-center">
			<p className="lead fw-bold border-bottom">Search Results</p>
			<button type="button" className="btn-close" onClick={()=>props.close()} aria-label="Close search results"></button>
		    </div>

		    {posts.length == 0 ?
		     <p>No results to display</p>
		     :
		     <>
			 {posts.map((post, index) => (
			     <React.Fragment key={`sim-post${index}`}>
				 <SimplePost
				     post={post}
				     jumpToPost={props.jumpToPost}
				 />
			     </React.Fragment>
			 ))}
		     </>
		    }

		    {currentModal === "error" &&
		     <ErrorModal
                         showModal = {true}
                         hideModal = {() => closeModal()}
                         message = {errorMessage}
                         drf = {drfError}
                     />
		    }
		    
		</>

	    )}
	</>
    )
}
