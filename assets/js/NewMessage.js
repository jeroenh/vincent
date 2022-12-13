import React, {useRef} from 'react';
import { Alert, Modal, Card, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import {AsyncTypeahead} from 'react-bootstrap-typeahead';
import { useCallback, useState, useEffect } from 'react';
import MessageAPI from './MessageAPI';
import Messenger from './Messenger';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css'
import DisplayLogo from "./DisplayLogo";
import ContactAPI from './ContactAPI';
import DeleteConfirmation from './DeleteConfirmation';
import ReCAPTCHA from "react-google-recaptcha";
import { Turnstile } from '@marsidev/react-turnstile';

const recaptchaRef = React.createRef();
let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const RECAPTCHA_SITE_KEY = appConfig.recaptcha_site_key || null;
const TURNSTILE_SITE_KEY = appConfig.turnstile_site_key || null;


const contactapi = new ContactAPI();

const messageapi = new MessageAPI();

const CACHE = {};
const PER_PAGE = 50;

const initialValue = [
    {
     	type: 'paragraph',
	children: [{ text: '' }],
    },
]



function makeAndHandleRequest(query, page = 1) {
    return contactapi.searchAllContacts(query).then((response) => {
	let items = response;
	let total_count = items.length;
	const options = items.map((i) => ({
	    name: i.name,
	    email: i.email,
	    uuid: i.uuid,
	    color: i.logocolor,
	    logo: i.photo
	}));
	return {options, total_count};
    });
}


const NewMessage = (props) => {

    const messageRef = useRef(null);
    const typeaheadref = useRef(null);
    const [messageTo, setMessageTo] = useState([]);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [disableButton, setDisableButton] = useState(true);
    const [suggested, setSuggested] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);
    const [invalidMessage, setInvalidMessage] = useState(false);
    const [invalidMessageTo, setInvalidMessageTo] = useState(false);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [allowSelectUser, setAllowSelectUser] = useState(false);
    const [title, setTitle] = useState("");
    const [invalidTitle, setInvalidTitle] = useState(false);

    const closeMessage = (e) => {
	setDeleteMessage("Your message is unsent.  Do you really want to cancel?")
	setDisplayConfirmationModal(true);
    }

    const handleInputChange = (q) => {
	setQuery(q);
    };

    const clearText = (e) => {
	if (e) {
	    e.preventDefault();
	}
	messageRef.current.clearText();
	setMessage(initialValue);
    }

    const uploadFiles = async(formData, filename) => {
        console.log(`Uploading ${filename}: ${formData}`);
        let data = await messageapi.addImage(formData);
        let results = await data.data;
        console.log(results);
        return results['image_url'];

    };

    useEffect(() => {

        if (message === JSON.stringify(initialValue)) {
            setDisableButton(true);
        } else {
	    setInvalidMessage(false);
            setDisableButton(false);
        }

    }, [message]);


    useEffect(() => {


	if (messageTo == "" && allowSelectUser) {
            setInvalidMessageTo(true);
        } else {
            setInvalidMessageTo(false);
        }

    }, [messageTo]);


    const lookupContact = async(contact) => {


	await contactapi.getContact(contact).then((response) => {
	    console.log(messageTo);
	    if (response.data.user_name) {
		setMessageTo((prev) => [...prev, {'uuid':response.data.uuid, 'name':response.data.user_name, 'color': response.data.logocolor}]);
	    } else {

		setMessageTo((prev) => [...prev, {'uuid':response.data.uuid, 'name':response.data.name, 'color': response.data.logocolor}]);
	    }
	    setIsLoading(false);

	}).catch(err => {
	    setError("Can't find user.");
	    console.log(err);
	});
    }

    useEffect(() => {

	if (props.coordinator) {
	    setAllowSelectUser(true);
	}
	if (props.sendContact) {
	    console.log(props.sendContact);
	    setIsLoading(true)
	    props.sendContact.forEach(c => {
		lookupContact(c);
	    });
	}

	if (document.getElementById('bounce_template')) {
	    setMessage([{
		type: 'paragraph',
		children: [{ text: document.getElementById('bounce_template').textContent }],
	    }])
	} else {
	    setMessage(initialValue);
	}

    }, [props]);

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }

    const handleSearch = useCallback((q) => {
	if (CACHE[q]) {
	    setOptions(CACHE[q].options);
	    return;
	}
	setIsLoading(true);
	makeAndHandleRequest(q).then((resp) => {
	    CACHE[q] = { ...resp, page: 1 };
	    setIsLoading(false);
	    setOptions(resp.options);
	});
    }, []);

    const handlePagination = (e, shownResults) => {
	const cachedQuery = CACHE[query];

	// Don't make another request if:
	// - the cached results exceed the shown results
	// - we've already fetched all possible results
	if (
	    cachedQuery.options.length > shownResults ||
		cachedQuery.options.length === cachedQuery.total_count
	) {
	    return;
	}

	setIsLoading(true);

	const page = cachedQuery.page + 1;

	makeAndHandleRequest(query, page).then((resp) => {
	    const options = cachedQuery.options.concat(resp.options);
	    CACHE[query] = { ...cachedQuery, options, page };

	    setIsLoading(false);
	    setOptions(options);
	});
    };

    const submitPost = async (e) => {
	e.preventDefault();

        let formField = new FormData();
	if (RECAPTCHA_SITE_KEY) {
	    const token = await recaptchaRef.current.executeAsync();
	    formField.append('token', token);
	} else if (TURNSTILE_SITE_KEY) {
	    const token = await recaptchaRef.current?.getResponse();
            formField.append('token', token);
	}


	if (messageTo == "" && allowSelectUser) {
	    setInvalidMessageTo(true);
	    return;
	} else {
	    setInvalidMessageTo(false);
	}

	if (message === initialValue || JSON.stringify(message) === JSON.stringify(initialValue)) {
            setInvalidMessage(true);
            return
        }

	let html = messageRef.current.sanitizeHTML(message);

	formField.append('content', html);
	formField.append('json', JSON.stringify(message));
	formField.append('url', window.location.pathname);

	if (allowSelectUser) {
	    messageTo.forEach(item => {
		formField.append('users[]', item.uuid);
            });
	} else {
	    if (title === "") {
		setInvalidTitle(true);
		return;
	    } else {
		setInvalidTitle(false);
	    }
	}

	formField.append('title', title);

	if (props.group) {
	    formField.append('from', props.group);
	}
	await messageapi.createThread(formField).then((response) => {
	    if (props.sendContact) {
		window.location.href="/cvdp/inbox";
	    }
	    setMessage('');
	    props.reload("Got it! Your message has been sent!");

	}).catch(err => {
	    if (err.response?.data) {
		setError(`Error sending message: ${err.response.data.message}`);
	    } else {
		setError(`Error sending message: ${err.message}`);
	    }

	});

    };

    return (
	<Card className="new-message-app">
            <Card.Header as="h5">
		<div className="d-flex justify-content-between">
		    <Card.Title>
			New Message
		    </Card.Title>
		    <Button variant="btn-icon" onClick={(e)=>closeMessage(e)}>Cancel</Button>
		</div>
            </Card.Header>

	    <Card.Body className="pb-5">
		{error &&
		 <Alert variant="danger"> {error}</Alert>
		}

		<Form>
		    {allowSelectUser ?
		     <>
			 <Form.Group className="mb-3" controlId="_type">
			     <Form.Label>To:</Form.Label>
			     <AsyncTypeahead
				 id="messageto"
				 ref={typeaheadref}
				 multiple
				 options = {options}
				 isLoading={isLoading}
				 onPaginate={handlePagination}
				 onSearch={handleSearch}
				 paginate
				 className="typeahead"
				 onChange={setMessageTo}
				 onInputChange={handleInputChange}
				 labelKey={(option) => (option.email ? `${option.name} (${option.email})` :
							`${option.name}`)}

				 filterBy={["name", "email"]}
				 selected = {messageTo}
				 isInvalid={invalidMessageTo}
				 placeholder="Search for a user"
				 renderMenuItemChildren={(option) => (
				<div className="d-flex align-items-center gap-2">
				    <DisplayLogo
					name={option.name}
					photo={option.logo}
					color={option.color}
				    />
				    <span className="participant">{option.name} {option.email && `(${option.email})`}</span>
				</div>

				 )}
				 useCache={false}
			     />
			 </Form.Group>
			 {invalidMessageTo &&
			  <Form.Text className="error">
                              This field is required.
			  </Form.Text>
			 }
		     </>
		     :
		     <>
			 <Alert variant="warning">Send a message to the coordination team.</Alert>
			 {props.reasons &&
			  <Form.Group className="mb-3" controlId="titleInput">
                              <Form.Label>Contact Reason<span className="required">*</span>:</Form.Label>
			      <Form.Select name="title" value={title} onChange={(e)=>setTitle(e.target.value)} aria-label="Contact Reason">
				  <option key={`choice-blank`} aria-label="No reason" value=""></option>
                                  {props.reasons.map((choice, idx) => (
                                      <option key={`choice-${idx}`} aria-label={choice} value={choice}>{choice} </option>
                                  ))}

                              </Form.Select>
			      {invalidTitle &&
			       <Form.Text className="error">
				   Please select a reason for contacting us. It helps us direct this message to the right coordinator.
                               </Form.Text>
			      }
                          </Form.Group>
			 }
		     </>

		    }
		    {message &&
		     <>
			 <Form.Group className="mb-3">
			     <Form.Label>Message:</Form.Label>
			     <Messenger
				 placeholder="Write your message"
				 setValue={setMessage}
				 value={message}
				 uploadFiles={uploadFiles}
				 ref={messageRef}
			     />
			 </Form.Group>
			 {invalidMessage &&
			  <Form.Text className="error pt-4">
                              This field is required.
			  </Form.Text>
			 }
			 {RECAPTCHA_SITE_KEY &&
			  <ReCAPTCHA
                              ref={recaptchaRef}
                              size="invisible"
                              sitekey={RECAPTCHA_SITE_KEY}
			  />
			 }

			 <div className="text-end pt-4">

			     {TURNSTILE_SITE_KEY &&
			      <div className="mb-3">
				  <Turnstile
				      ref={recaptchaRef}
				      appearance="interaction-only"
				      siteKey={TURNSTILE_SITE_KEY}
				  />
			      </div>
			     }

			     <button onClick={(e)=>clearText(e)} className="mx-1 btn btn-outline-secondary">Cancel</button>
			     <button onClick={(e) => submitPost(e)} disabled={disableButton ? true : false} className="btn btn-primary">Submit</button>
			 </div>
		     </>
		    }

		</Form>
		<DeleteConfirmation
                    showModal={displayConfirmationModal}
                    confirmModal={props.cancelMessage}
                    hideModal={hideConfirmationModal}
                    id="something"
		    buttonText="Yes"
                    message={deleteMessage} />
	    </Card.Body>
        </Card>
    )


}


export default NewMessage;
