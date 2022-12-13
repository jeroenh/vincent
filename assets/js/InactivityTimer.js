import React, { useState, useEffect } from 'react';
import { Modal, Button } from "react-bootstrap";
import { useIdleTimer } from 'react-idle-timer'
import { useNavigate } from 'react-router'
import { Outlet, useLocation, useNavigationType } from 'react-router';
import AdminAPI from "./AdminAPI.js";

const adminapi = new AdminAPI();

const promptbeforeidle = 30_000;
const timeout_default = 20 * 60 * 1000;

const InactivityTimer = (props) => {
    //const { ComposedClass } = props
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [remaining, setRemaining] = useState(promptbeforeidle);
    const location = useLocation();
    const [timeout, setTimeout] = useState(timeout_default);
    const [disabled, setDisabled] = useState(true);
    const navigationType = useNavigationType();


    /* //DEBUG for routing 
    useEffect(() => {
	console.log("The current URL is", {...location});
	console.log("The last navigation action was", navigationType);
    }, [location, navigationType]);
    */

    useEffect(() => {

	let timeout = adminapi.getInactivityTimer();
	if (timeout) {
	    console.log(`Inactivity timeout set to ${timeout}`);
	    setTimeout(timeout);
	    setDisabled(false);
	} else {
	    setDisabled(true);
	}
	
    }, []);

    const onPrompt = () => {
	setOpen(true)
    }

    const onActive = () => {
	setOpen(false)
    }

    const logoutUser = async () => {
	await adminapi.logoutUser().then((response) => {
	    window.location.reload();
	});

    }

    
    const handleOnIdle = (event) => {
	setOpen(false);
	logoutUser();
    }

    const handleStillHere = () => {
	activate()
    }

    const {getLastActiveTime, getRemainingTime, activate } = useIdleTimer({
	disabled: disabled,
	onIdle:handleOnIdle,
	onActive: onActive,
	onPrompt: onPrompt,
	timeout: timeout,
	promptBeforeIdle: promptbeforeidle,
        debounce: 500,
    })
    
    useEffect(() => {
	/* only do calculations if modal is open */
	if (open) {
	    const interval = setInterval(() => {
		setRemaining(Math.ceil(getRemainingTime() / 1000))
	    }, )
	    
	    return () => {
		clearInterval(interval)
	    }
	}
    }, [open])


    return (
	<>
	    <Outlet />
	    <Modal show={open} onHide={handleStillHere} backdrop="static" centered>
		<Modal.Header closeButton>
		    <Modal.Title>Session Timeout</Modal.Title>
		</Modal.Header>
		<Modal.Body>
		    <p className="lead">
			Hey!  Are you still there?  Your session will be ending in {remaining} seconds.
		    </p>
		</Modal.Body>
		<Modal.Footer>
		    <Button variant="primary" onClick={handleStillHere}>
			I'm still here!
		    </Button>
		</Modal.Footer>
	    </Modal>
	</>

    );
}

export default InactivityTimer;
