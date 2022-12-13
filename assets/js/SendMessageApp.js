import React, { useState, useRef, useEffect, useMemo } from "react";
import {
    Nav,
    Dropdown,
    DropdownButton,
    InputGroup,
    CardGroup,
    Alert,
    Button,
    Tab,
    Tabs,
    Row,
    Form,
    Card,
    Col,
} from "react-bootstrap";
import "../css/casethread.css";
import Messenger from "./Messenger";
import LoadingDiv from "./LoadingDiv";
import MessageAPI from "./MessageAPI";

const initialValue = [
    {
        type: "paragraph",
        children: [{ text: "" }],
    },
];

const messageapi = new MessageAPI();

const SendMessageApp = (props) => {

    const messageRef = useRef(null);
    const [disableButton, setDisableButton] = useState(true);
    const [message, setMessage] = useState(initialValue);
    const [invalidMessage, setInvalidMessage] = useState(false);
    const [error, setError] = useState(null);
    const [fileUpload, setFileUpload] = useState(false);
    const [loading, setLoading] = useState(false);


    const uploadFiles = async (formData, filename) => {
        console.log(`Uploading ${filename}: ${formData}`);
        let data = await messageapi.addImage(formData, {'id': props.thread});
        let results = await data.data;
	setFileUpload(true);
        console.log(results);
        return results["image_url"];
    };

    useEffect(() => {
        if (
            message === initialValue ||
            JSON.stringify(message) === JSON.stringify(initialValue)
        ) {
            setDisableButton(true);
        } else {
            setDisableButton(false);
            setInvalidMessage(false);
        }
    }, [message]);


    const submitMessage = async (e) => {
        e.preventDefault();

        setDisableButton(true);
        let formField = new FormData();

        if (
            message === initialValue ||
            JSON.stringify(message) === JSON.stringify(initialValue)
        ) {
            setInvalidMessage(true);
            return;
        }

        let html = messageRef.current.sanitizeHTML(message);

        formField.append("content", html);
        formField.append("json", message);

	if (fileUpload) {
	    /* reload Messenger app to get rid of file */
	    setLoading(true);
	}

        await messageapi
            .createMessage({'id': props.thread}, formField)
            .then((response) => {
                props.messageSent(response);
                setDisableButton(false);

		setLoading(false);
		if (fileUpload) {
		    setFileUpload(false);
		} else {
		    messageRef.current.clearText();
		}

                setMessage(initialValue);
            })
            .catch((err) => {
                console.log(err);
                setError(`Error sending message: ${err.response.data.message}`);
            });
    };


    return (
        <form>
            <Card className="w-100 chat-messenger mt-1">
                {error && <Alert variant="danger"> {error}</Alert>}

                <Card.Body>
		    {loading ?

		     <LoadingDiv />
		     
		     :

                     <Messenger
                         placeholder="Write a new message to continue the thread"
                         setValue={setMessage}
                         value={message}
                         uploadFiles={uploadFiles}
                         ref={messageRef}
                     />
		    }

                    {invalidMessage && (
                        <small className="warningtext">
                            This field is required.
                        </small>
                    )}
                </Card.Body>
                <Card.Footer>
                    <Button
                        variant="outline-primary"
                        className="float-end"
                        disabled={disableButton ? true : false}
                        onClick={(e) => submitMessage(e)}
                    >
                        Send
                    </Button>
                </Card.Footer>
            </Card>
        </form>
    );
};

export default SendMessageApp;
