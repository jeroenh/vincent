import React, { useState, useEffect, useMemo } from 'react';
import {Row, Alert, Card, Col, Button, Form, Dropdown, Tab, Nav, InputGroup, DropdownButton} from 'react-bootstrap';
import '../css/casethread.css';
import ContactAPI from './ContactAPI';
import DeleteConfirmation from './DeleteConfirmation';
import validator from "validator";

const contactapi = new ContactAPI();

const GroupContactApp = (props) => {

    const [apiError, setApiError] = useState(false);
    const [emails, setEmails] = useState([""]);
    const [phone, setPhone] = useState("");
    const [webUrl, setWebUrl] = useState("");
    const [address, setAddress] = useState("");
    const [invalidEmail, setInvalidEmail] = useState([]);
    const [invalidPhone, setInvalidPhone] = useState(false);
    const [invalidWebsite, setInvalidWebsite] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const updateGroupInfo = async() => {
	if (invalidEmail.length > 0 || invalidPhone || invalidWebsite) {
	    setApiError("Please add valid information");
	    return;
	}
	
        let formData = {}
        formData['support_emails'] = emails;
	formData['support_phone'] = phone;
	formData['website'] = webUrl;
	formData['mailing_address'] = address;
	await contactapi.updateMyGroup(props.group.uuid, formData).then(response => {
            /* todo - just modify group in place */
	    setShowSuccess(true);
	    setApiError(false);
	    props.update();
        }). catch(err => {
            setApiError(`Error: ${err.message}`);
        });
    }

    useEffect(() => {

	let invalids = [];
	
        if (emails.length > 0) {
	    emails.forEach((e, idx) => {
		if (!validator.isEmail(e)) {
		    invalids.push(idx);
		}
	    })
        }

	setInvalidEmail(invalids);

    }, [emails]);


    useEffect(() => {

        if (phone) {
            if (validator.isMobilePhone(phone)) {
                setInvalidPhone(false);
            } else {
                setInvalidPhone(true);
            }
        }

    }, [phone]);

    useEffect(() => {

        if (webUrl) {
            if (validator.isURL(webUrl)) {
                setInvalidWebsite(false);
            } else {
                setInvalidWebsite(true);
            }
        }

    }, [webUrl]);

    useEffect(() => {
	if (props.group) {
	    if (props.group.support_emails.length > 0) {
		setEmails(props.group.support_emails);
	    } else {
		setEmails([""]);
	    }
	    if (props.group.support_phone) {
		setPhone(props.group.support_phone);
	    } else {
		setPhone("");
	    }
	    if (props.group.website) {
		setWebUrl(props.group.website);
	    } else {
		setWebUrl("");
	    }
	    if (props.group.mailing_address) {
		setAddress(props.group.mailing_address);
	    } else {
		setAddress("");
	    }
	}
    }, [props]);

    function reset() {

        if (props.group.support_emails.length > 0) {
            setEmails(props.group.support_emails);
        } else {
            setEmails([""]);
        }
        if (props.group.support_phone) {
            setPhone(props.group.support_phone);
        } else {
                setPhone("");
        }
        if (props.group.website) {
            setWebUrl(props.group.website);
        } else {
                setWebUrl("");
        }
        if (props.group.mailing_address) {
            setAddress(props.group.mailing_address);
        } else {
            setAddress("");
        }
        setInvalidEmail([]);
        setInvalidPhone(false);
	setInvalidWebsite(false);
    }

    const handleIndexChange = (i, e) => {

        let newFormValues = [...emails];
        newFormValues[i] = e.target.value;
        setEmails(newFormValues);
    }

    const removeEmail = (i) => {
        let newFormValues = [...emails];
        newFormValues.splice(i, 1);
        if (newFormValues.length == 0) {
            newFormValues = [""];
        }
        setEmails(newFormValues)
        setUserInput(true);
    }


    const addEmail = () => {
	let newFormValues = [...emails];
	newFormValues.push("");
	setEmails(newFormValues);
    }
    
    return (
	<>
	 {apiError &&
          <Alert variant="danger">Error: {apiError}</Alert>
         }
	    <>
	    {showSuccess &&
	     <Alert variant="success">Got it! Your changes have been saved!</Alert>
	    }
	    </>
	    <Row>
		{emails.length > 0 ? ""
		 :
		 <>
		     <Col lg={6} className="mb-3">
			 <Alert variant="danger">Please add a contact email address for this organization.</Alert>
		     </Col>
		     <Col lg={6}>
		     </Col>
		 </>
		}

		<Col lg={6} className="mb-3">
		    <Form.Group controlId="supportEmailAddresses">
		    <Form.Label>Support Email Address</Form.Label>
		    {emails.map((email, index) => (
                        <div key={`email-${index}`} className="border-bottom py-2 mb-2">
			    <Row>				
				<Col lg={11} sm={11} md={11}>
				    <Form.Control name="email" value={email} onChange={(e)=>handleIndexChange(index, e)} isInvalid={invalidEmail.includes(index)} />
				    {invalidEmail.includes(index) &&
				     <Form.Text className="error">
					 Please enter a valid email.
				     </Form.Text>
				    }
				    
				</Col>
				<Col lg={1} sm={1} md={1} className="px-0 mx-0">                                                                          
                                    <Button className="mx-0" variant="btn btn-icon" onClick={() => removeEmail(index)}><i className="fas fa-trash" title="remove email"></i></Button>
				</Col>
			    </Row>
			</div>
			
		    ))}
		    </Form.Group>
		    <Button size="sm" variant="outline-primary" onClick={()=>addEmail()}><i className="fas fa-plus"></i> Add Email</Button> 
		</Col>
		<Col lg={6} className="mb-3">
		    <Form.Group controlId="phoneNumberInput">
			<Form.Label>Support Phone Number</Form.Label>
			<Form.Control name="phone" value={phone} onChange={(e)=>setPhone(e.target.value)} isInvalid={invalidPhone} />
			{invalidPhone &&
			 <Form.Text className="error">
                             Please enter a valid phone number.
			 </Form.Text>
			}
		    </Form.Group>
		</Col>
		<Col lg={6} className="mb-3">
		    <Form.Group controlId="websiteInput">
		    <Form.Label>Website</Form.Label>
		    <Form.Control name="weburl" value={webUrl} onChange={(e)=>setWebUrl(e.target.value)} isInvalid={invalidWebsite}/>
		    {invalidWebsite &&
                         <Form.Text className="error">
                             Please enter a valid URL.
                         </Form.Text>
		    }
		    </Form.Group>
		</Col>
		<Col lg={6} className="mb-3">
		    <Form.Group controlId="locationInput">
			<Form.Label>Mailing Address/Location</Form.Label>
			<Form.Control name="address" as="textarea" rows={3} value={address} onChange={(e)=>setAddress(e.target.value)}/>
		    </Form.Group>
		</Col>

		<Col lg={12} className="mt-3">
		    <div className="d-flex align-items-start gap-3">
			<Button type="Cancel" variant="secondary" onClick={()=>reset()}>
                            Cancel
			</Button>
			
			<Button variant="primary" type="submit" onClick={()=>updateGroupInfo()}>
                            Submit
			</Button>
		    </div>
		</Col>
	    </Row>		

	</>
    )

}


export default GroupContactApp;
