import React, { useRef, useState, useEffect, useCallback } from 'react';
import {Card,Toast, Tab, Nav, DropdownButton, Dropdown, InputGroup, Form, Row, Col, Table, Accordion, Alert, Button} from 'react-bootstrap';
import CaseThreadAPI from './ThreadAPI';
import AdminAPI from "./AdminAPI";
import { format, formatDistance } from 'date-fns'
import {useParams, useNavigate, Link, useLocation} from "react-router"

const threadapi = new CaseThreadAPI();
const adminapi = new AdminAPI();

const PUBLISHER_CATEGORY = [
    "coordinator",
    "discoverer",
    "translator",
    "user",
    "vendor",
    "other"
]

const NOTE_CATEGORY = [
    "description",
    "details",
    "faq",
    "general",
    "legal_disclaimer",
    "other",
    "summary"
]


const TLP_LABELS = [
    "AMBER",
    "GREEN",
    "RED",
    "WHITE"
]

const REF_CATEGORY = [
    "self",
    "external"
]

const CSAFSettings = () => {


    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [error, setError] = useState(null);
    const [csafSettings, setCSAFSettings] = useState({publisher: {category: 'coordinator', contact_details: '', issuing_authority: '', name: '', namespace: ''}, id: '', lang: 'en-US', distribution: {tlp: {label: 'WHITE'}}})
    const [documentNotes, setDocumentNotes] = useState([]);
    const [documentReferences, setDocumentReferences] = useState([]);
    const [documentAcks, setDocumentAcks] = useState([{names: []}]);
    const [userInput, setUserInput] = useState({doc: false, refs: false, notes: false, acks: false})
    const [activeTab, setActiveTab] = useState("doc")
    const [profiles, setProfiles] = useState([]);
    const [existingSettings, setExistingSettings] = useState(false);


    const [showToast, setShowToast] = useState({
        show: false,
        msg: "",
        type: "",
	bg: "success"
    });


    function replace_year(str) {
	let year = new Date().getFullYear().toString();
	if (str.includes('YYYY')) {
	    str = str.replace('YYYY', year);
	} else if (str.includes('YY')) {
	    year = year.slice(-2);
	    str = str.replace('YY', year);
	}

	return str;
    }

    const requestDocumentId = async () => {

	await adminapi.getCSAFDocId(id).then((response) => {
	    if ('document_id' in response) {
		setCSAFSettings({...csafSettings, id: response['document_id']});
		setShowToast({
		    show: true,
		    msg: "Successfully updated document ID. Confirm all references are using new document ID.",
		    type: activeTab,
		    bg: 'success'
		});
		const el = document.getElementById('csaf-settings');
		el?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		
	    } else {
		setShowToast({
		    show: true,
		    msg: `Unable to assign document ID: ${response['error']}`,
		    type: activeTab,
		    bg: 'danger'
		});
		const el = document.getElementById('csaf-settings');
		el?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	    }
	}).catch(err => {
	    setShowToast({
		show: true,
		msg: `An error occurred assigning document ID: ${err.message}: ${err.response?.data?.error}.`,
		type: activeTab,
		bg: 'danger'
	    });
	    const el = document.getElementById('csaf-settings');
            el?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	    setError(`Unable to assign document ID: ${err.message}: ${err.response?.data?.error}`);
	})
    }
    
    
    const fetchInitialData = async () => {

	if (caseInfo == null) {
            await threadapi.getCase({'case': id}).then((response) => {
		setCaseInfo(response);
            }).catch(err => {
                if (err.response.status == 403 || err.response.status==404) {
                    navigate("../err");
                }
                setError(`Error: ${err.message}`);
            });
        }

	if (profiles.length == 0) {
	    await adminapi.getCSAFProfiles().then((response) => {
		console.log(response);
		setProfiles(response);
	    }).catch(err => {
		console.log(err);
	    });
	}

	await threadapi.getCSAFSettings({'case': id}).then((response) => {

	    setCSAFSettings({publisher: response['publisher_settings'], lang: response['lang'], id: response['doc_id'], distribution: {tlp: {label: response['distribution_tlp']}}})
	    setExistingSettings(true);
	    setDocumentReferences(response['references']);
	    setDocumentNotes(response['notes']);
	    if (Array.isArray(response['acknowledgments'])) {
		setDocumentAcks(response['acknowledgments']);
	    } else {
		setDocumentAcks([response['acknowledgments']]);
	    }



	}).catch(err => {
	    console.log(err);
	    if (err.response.status != 404) {
		/*settings don't exist if == 404*/
		navigate("../err");
	    }
	});


    }

    useEffect(() => {
        fetchInitialData();
    }, []);

    const handleIndexChange = (t, i, e, idx=null) => {

	let formname = e.target.name


	if (t === "note") {
            let newFormValues = [...documentNotes];
            newFormValues[i][formname] = e.target.value;
            setDocumentNotes(newFormValues);
	    setUserInput({...userInput, notes: true})
	} else if (t === "ref") {
	    let newFormValues = [...documentReferences];
            newFormValues[i][formname] = e.target.value;
            setDocumentReferences(newFormValues);
	    setUserInput({...userInput, refs: true})
	} else {
	    let newFormValues = [...documentAcks];
	    if (formname === "names") {
		newFormValues[i][formname][idx] = e.target.value;
	    } else {
		newFormValues[i][formname] = e.target.value;
	    }
            setDocumentAcks(newFormValues);
	    setUserInput({...userInput, acks: true})
	}


    }

    const removeAck = (i) => {
        let newFormValues = [...documentAcks];
        newFormValues.splice(i, 1);
        setDocumentAcks(newFormValues)
	setUserInput({...userInput, acks: true})
    }

    const removeDocNote = (i) => {
	let newFormValues = [...documentNotes];
        newFormValues.splice(i, 1);
        setDocumentNotes(newFormValues)
	setUserInput({...userInput, notes: true})
    }

    const removeDocRef = (i) => {
	let newFormValues = [...documentReferences];
        newFormValues.splice(i, 1);
        setDocumentReferences(newFormValues)
	setUserInput({...userInput, refs: true})
    }

    const saveSettings = async () => {
	const formDataObj = {};

	if (activeTab == "doc") {
	    formDataObj['distribution_tlp'] = csafSettings.distribution.tlp.label;
	    formDataObj['doc_id'] = csafSettings.id;
	    formDataObj['lang'] = csafSettings.lang;
	    formDataObj['publisher_settings'] = csafSettings.publisher;
	    if (csafSettings.doc_id_format) {
		formDataObj['doc_id_format'] = csafSettings.doc_id_format;
	    }
	    setUserInput({...userInput, doc: false})
	} else if (activeTab == "refs") {
	    formDataObj['references'] = documentReferences;
	    setUserInput({...userInput, refs: false})
	} else if (activeTab == "notes") {
	    formDataObj['notes'] = documentNotes;
	    setUserInput({...userInput, notes: false})
	} else if (activeTab == "acks") {
	    if (documentAcks.length > 0) {
		formDataObj["acknowledgments"] = documentAcks;
	    } else {
		formDataObj["acknowledgments"] = [];
	    }
	    setUserInput({...userInput, acks: false})
	}

	await threadapi.saveCSAFSettings({'case': id}, formDataObj).then((response) => {

	    setShowToast({
                show: true,
                msg: "Got it! Your changes have been saved!",
                type: activeTab,
		bg: 'success'
            });

	    const el = document.getElementById('csaf-settings');
            el?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })

	}).catch((err) => {
	    console.log(err);
	    const el = document.getElementById('csaf-settings');
            el?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	    setShowToast({
		show: true,
		msg: "An error occurred.",
		type: activeTab,
		bg: 'danger'
	    });
	});

    }

    const handleChange = (e) => {
	let formname = e.target.name
	const {name, value} = e.target;

	if (name.startsWith("publisher")) {
	    const elem = name.split('.');
	    setCSAFSettings({...csafSettings, publisher: {...csafSettings.publisher, [elem[1]]: value}});
	} else if (name == "id") {
	    setCSAFSettings({...csafSettings, id: value});
	} else if (name == "lang") {
	    setCSAFSettings({...csafSettings, lang: value});
	} else {
	    setCSAFSettings({...csafSettings, distribution: {tlp: {label: value}}});
	}
	setUserInput({...userInput, doc: true})
    }


    const addDocumentNote = () => {
        setDocumentNotes([...documentNotes, {category: 'description', text: '', title: ''}])
    }

    const addDocumentReference = () => {
	setDocumentReferences([...documentReferences, {summary: '', url: '', category: 'external'}])
    }

    const addDocumentAck = () => {
	setDocumentAcks([...documentAcks, {names: [''], organization: '', summary: ''}]);
    }

    const addDocumentAckName = (idx) => {
	let acks = documentAcks.map((a, index) => {
	    if (index == idx) {
		a.names.push("");
	    }
	    return a;
	});
	setDocumentAcks(acks);
    }

    const removeDocumentAckName = (o, i) => {
	let acks = documentAcks.map((a, index) => {
	    if (index == o) {
		let names = a.names.filter((n, k) => k != i);
		a.names = names;
	    }
	    return a;
	});
	setDocumentAcks(acks);
    }

    function importProfile(evt, evtKey) {

	let profile = profiles.find((p) => p.id == evt);
	let showtoast = false;
	let changes = userInput;

	if (profile.notes.length > 0) {
	    setDocumentNotes([...documentNotes, ...profile.notes]);
	    changes['notes'] = true;
	}
	if (profile.references.length > 0) {
	    let refs = profile.references.map(r => {
		let new_ref = {category: r.category, url: r.url, summary: r.summary};
		if (new_ref.url.includes("{{doc_id}}")) {
		    showtoast = true;
		}
		if (new_ref.summary.includes("{{doc_id}}")) {
		    showtoast = true;
		}
		return new_ref;
	    })
	    setDocumentReferences([...documentReferences, ...refs]);
	    changes['refs'] = true;

	    if (showtoast) {
		setShowToast({
                    show: true,
                    msg: "Imported references have placeholder for document ID. When document ID is available, click button to update references with valid document ID.",
                    type: activeTab,
                    bg: 'danger'
		});
	    }
	}

	if (profile.document_id) {
	    let doc_id = profile.document_id;
	    if (profile.document_id.includes('YY') || profile.document_id.includes('YYYY')) {
		doc_id = replace_year(profile.document_id)
	    }
	    console.log(doc_id);
	    setCSAFSettings({...csafSettings, id: doc_id, publisher: profile.publisher_settings, profile: profile.lang, distribution: {tlp: {label: profile.distribution_tlp }}, doc_id_format: profile.document_id});

	} else {
	    setCSAFSettings({...csafSettings, publisher: profile.publisher_settings, profile: profile.lang, distribution: {tlp: {label: profile.distribution_tlp }}});
	}

	changes['doc'] = true;
	setUserInput(changes);

    }

    const updateRef = () => {
	
	let showtoast = false;
	let changes = userInput;
	
	let refs = documentReferences.map(r => {
	    let new_ref = {category: r.category, url: r.url, summary: r.summary};
	    if (new_ref.url.includes("{{doc_id}}")) {
		if (csafSettings.id) {
		    new_ref['url'] = new_ref.url.replace("{{doc_id}}", csafSettings.id.toLowerCase().replace(/ /g,"_"));
		} else {
		    showtoast = true;
		}
	    }
	    if (new_ref.summary.includes("{{doc_id}}")) {
		if (csafSettings.id) {
		    new_ref['summary'] = new_ref.summary.replace("{{doc_id}}", csafSettings.id.toLowerCase());
		} else {
		    showtoast = true;
		}
	    }
	    return new_ref;
	})
	setDocumentReferences(refs);
	changes['refs'] = true;

	if (showtoast) {
	    setShowToast({
                show: true,
                msg: "Imported references have placeholder for document ID but document ID does not exist.",
                type: activeTab,
                bg: 'danger'
	    });
	}
	setUserInput(changes);
    }
    

    return (
	<>
	    {caseInfo &&
             <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> <Link to={'..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / CSAF Settings</h4>
            }

	    <Tab.Container
		defaultActiveKey="doc"
		activeKey = {activeTab}
		className="mb-3"
		onSelect={setActiveTab}
            >
		<Nav variant="pills" className="mb-3">
                    <Nav.Item key="doc">
			<Nav.Link eventKey="doc">Document Settings {userInput.doc && <i className="fas fa-exclamation-triangle warningtext" title="Save required"></i>}</Nav.Link>
                    </Nav.Item>
                    <Nav.Item key="notes">
			<Nav.Link eventKey="notes">Document Notes {userInput.notes && <i title="Save required" className="fas fa-exclamation-triangle warningtext"></i>}</Nav.Link>
                    </Nav.Item>
		     <Nav.Item key="refs">
                        <Nav.Link eventKey="refs">Document References {userInput.refs && <i title="Save required" className="fas fa-exclamation-triangle warningtext"></i>}</Nav.Link>
                     </Nav.Item>
		     <Nav.Item key="acks">
                        <Nav.Link eventKey="acks">Acknowledgments {userInput.acks && <i title="Save required" className="fas fa-exclamation-triangle warningtext"></i>}</Nav.Link>
                    </Nav.Item>
		</Nav>
		<Tab.Content id="csaf-settings" className="p-0">
                    <Tab.Pane eventKey="doc" key="doc">
			<Card className="mb-4">
			    <Card.Header as="h5" className="d-flex justify-content-between">
				<Card.Title>Document Settings</Card.Title>
				{profiles.length > 0 &&
				 <DropdownButton
				     variant="primary"
				     size="sm"
				     onSelect={importProfile}
				     title={
					 <span>
					     Import CSAF Profile{" "}
					     <i className="fas fa-chevron-down"></i>
					 </span>
				     }
				 >
                                     {profiles.map((profile, index) => (
					 <Dropdown.Item
					     key={`profile-${index}`}
					     eventKey={profile.id}
					 >
					     {profile.name}
					 </Dropdown.Item>
				     ))}
				 </DropdownButton>
				}
			    </Card.Header>
			    <Card.Body>
				<Row className="mb-3">
				    <Col lg={8} md={8} sm={8}>
				    <Form.Group className="mb-3">
					<Form.Label>Publisher Category</Form.Label>
					<Form.Select name="publisher.category" value={csafSettings.publisher.category} onChange={(e)=>handleChange(e)} aria-label="Publisher Category">
					    {PUBLISHER_CATEGORY.map((choice) => (
						<option key={choice} value={choice}>{choice} </option>
					    ))}
					</Form.Select>
				    </Form.Group>
					<Form.Group className="mb-3">
					<Form.Label>Publisher Contact Details</Form.Label>
					    <Form.Control name="publisher.contact_details" value={csafSettings.publisher.contact_details || "" } onChange={(e)=>handleChange(e)} aria-label="Publisher Contact Details" />
					</Form.Group>
					<Form.Group className="mb-3">
                                            <Form.Label>Publisher Issuing Authority</Form.Label>
                                            <Form.Control name="publisher.issuing_authority" value={csafSettings.publisher.issuing_authority || ""} onChange={(e)=>handleChange(e)} aria-label="Publisher Issuing Authority" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <Form.Label>Publisher Name</Form.Label>
					    <Form.Control name="publisher.name" value={csafSettings.publisher.name || ""} onChange={(e)=>handleChange(e)} aria-label="Publisher Name" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <Form.Label>Publisher Namespace</Form.Label>
					    <Form.Control name="publisher.namespace" value={csafSettings.publisher.namespace || ""} onChange={(e)=>handleChange(e)} aria-label="Publisher Namespace" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <Form.Label>Document Language</Form.Label>
					    <Form.Control name="lang" value={csafSettings.lang || ""} onChange={(e)=>handleChange(e)} aria-label="Document language" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <div className="d-flex align-items-center gap-2 mb-2">
						<Form.Label>Document ID</Form.Label>
						<Button onClick={(e)=>requestDocumentId(e)} size="xs" variant="primary">Request New Document ID</Button>
					    </div>
					    <Form.Control name="id" value={csafSettings.id || ""} onChange={(e)=>handleChange(e)} aria-label="Document ID" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <Form.Label>Distribution TLP</Form.Label>

					    <Form.Select name="tlp" value={csafSettings.distribution.tlp.label || ""} onChange={(e)=>handleChange(e)} aria-label="TLP">
						{TLP_LABELS.map((choice) => (
						    <option key={choice} value={choice}>{choice} </option>
						))}
					    </Form.Select>
					</Form.Group>
				    </Col>
				    <Col lg={4} md={4} sm={4}>
					<div className="float-end">
					    <Toast
						bg={showToast.bg}
						onClose={() =>
						    setShowToast({ show: false, type: "save" })
						}
						show={showToast.show && showToast.type == "doc"}
					    >
						<Toast.Body>{showToast.msg}</Toast.Body>
					    </Toast>
					</div>
				    </Col>
				</Row>

			    </Card.Body>
			    <Card.Footer>
				<div className="d-flex align-items-center gap-2">
				    <Button variant="secondary"  onClick={()=>fetchInitialData()}>Cancel</Button>
				    <Button variant="primary" onClick={()=>saveSettings()}>Save</Button>
				</div>
			    </Card.Footer>
			</Card>
		    </Tab.Pane>
		    <Tab.Pane eventKey="notes" key="notes">
			<Card>
			    <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
				<Card.Title>
				    Document Notes
				</Card.Title>
			    </Card.Header>
			    <Card.Body>
				<Row>
                                    <Col lg={8} md={8} sm={12}>
				{documentNotes.map((element, index) => (
				    <div key={`documentNotes-${index}`} className="border-bottom py-2 mb-2">
					<div className="d-flex align-items-center gap-4">
					    <Form.Group className="mb-3" controlId="noteCategory">
						<Form.Label>Note Category</Form.Label>
						<Form.Select name="category" value={element.category} onChange={(e)=>handleIndexChange("note", index, e)} aria-label="Note Category">
						    {NOTE_CATEGORY.map((choice) => (
							<option key={choice} value={choice}>{choice} </option>
						    ))}
						</Form.Select>
					    </Form.Group>
					    <Button variant="danger" size="sm" title="Remove Note" onClick={() => removeDocNote(index)}><i className="fas fa-trash"></i> Remove Note</Button>
					</div>

					<Form.Group className="mb-3" controlId="noteTitle">
					    <Form.Label>Note Title</Form.Label>
                                            <Form.Control name="title" value={element.title} onChange={(e)=>handleIndexChange("note", index, e)} aria-label="Note Title" />
					</Form.Group>
					<Form.Group className="mb-3" controlId="noteContent">
                                            <Form.Label>Note Content</Form.Label>
                                            <Form.Control name="text" value={element.text} onChange={(e)=>handleIndexChange("note", index, e)} aria-label="Note Content" as="textarea" rows="3" />
					</Form.Group>
				    </div>
				))}
				    </Col>
                                    <Col lg={4} md={4} sm={4}>
                                        <div className="float-end">
                                            <Toast
                                                bg={showToast.bg}
                                                onClose={() =>
                                                    setShowToast({ show: false, type: "save" })
                                                }
                                                show={showToast.show && showToast.type == "notes"}
                                            >
                                                <Toast.Body>{showToast.msg}</Toast.Body>
                                            </Toast>
                                        </div>
                                    </Col>
                                    </Row>
				<Button size="sm" variant="primary" onClick={()=>addDocumentNote()}>Add Note</Button>
			    </Card.Body>
			    <Card.Footer>
				<div className="d-flex align-items-center gap-2">
                                    <Button variant="secondary"  onClick={()=>fetchInitialData()}>Cancel</Button>
				    <Button variant="primary"  onClick={()=>saveSettings()}>Save</Button>
				</div>
			    </Card.Footer>
			</Card>
		    </Tab.Pane>
		    <Tab.Pane eventKey="refs" key="refs">
			<Card>
                            <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
                                <Card.Title>
                                    Document References
                                </Card.Title>
                            </Card.Header>
			    <Card.Body>
				{documentReferences.length > 0 &&
				<Row className="mb-3">
				    <Col lg={8} md={8} sm={12}>
					<p>Once document ID has been reserved, use this button to replace all <b>&#123;&#123;doc_id&#125;&#125;</b> placeholders with actual document ID.</p>
					<Button onClick={(e)=>updateRef()} variant="outline-primary" size="sm">Update References with Document ID</Button>
				    </Col>
				</Row>
				}
				<Row>
				    <Col lg={8} md={8} sm={12}>
				{documentReferences.map((element, index) => (
				    <div key={`documentRef-${index}`} className="border-bottom py-2 mb-2">
					<div className="d-flex align-items-center gap-4">
					<Form.Group className="mb-3" controlId="referenceCategory">
                                            <Form.Label>Reference Category</Form.Label>
					    <Form.Select name="category" value={element.category} onChange={(e)=>handleIndexChange("ref", index, e)} aria-label="Reference Category">
                                                {REF_CATEGORY.map((choice) => (
                                                    <option key={choice} value={choice}>{choice} </option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                            <Button variant="danger" size="sm" onClick={() => removeDocRef(index)}><i className="fas fa-trash"></i> Remove Reference</Button>
					</div>

					<Form.Group className="mb-3" controlId="referenceUrl">
					    <Form.Label>Reference URL</Form.Label>
					    <Form.Control name="url" value={element.url} onChange={(e)=>handleIndexChange("ref", index, e)} aria-label="Reference URL" />
					</Form.Group>
					<Form.Group className="mb-3" controlId="referenceSummary">
					    <Form.Label>Reference Summary</Form.Label>
					    <Form.Control name="summary" value={element.summary} onChange={(e)=>handleIndexChange("ref", index, e)} aria-label="Reference Summary" />
					</Form.Group>
				    </div>
				))}
				    </Col>
				    <Col lg={4} md={4} sm={4}>
                                        <div className="float-end">
					    <Toast
                                                bg={showToast.bg}
                                                onClose={() =>
						    setShowToast({ show: false, type: "save" })
                                                }
                                                show={showToast.show && showToast.type == "refs"}
					    >
                                                <Toast.Body>{showToast.msg}</Toast.Body>
					    </Toast>
                                        </div>
				    </Col>
				</Row>
				    <Button size="sm" variant="primary" title="Add Reference" onClick={()=>addDocumentReference()}>Add Reference</Button>
				</Card.Body>
				<Card.Footer>
				<div className="d-flex align-items-center gap-2">
                                    <Button variant="secondary"  onClick={()=>fetchInitialData()}>Cancel</Button>
				    <Button variant="primary"  onClick={()=>saveSettings()}>Save</Button>
				</div>
			    </Card.Footer>
			</Card>
		    </Tab.Pane>
		    <Tab.Pane eventKey="acks" key="acks">
			<Card>
                            <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
                                <Card.Title>
				    Document Acknowledgments
                                </Card.Title>
                            </Card.Header>
			    <Card.Body>
				<Row>
                                    <Col lg={12} md={12} sm={12}>
					{documentAcks.map((element, index) => (
					    <div key={`documentAck-${index}`} className="border-bottom py-2 mb-2">
						<Row className="mb-3">
						    <Col lg={5} sm={10} md={5}>
							{element.names?.map((name, idx) => (
							    <Form.Group className="mb-3" key={`ack-name${index}-${idx}`} controlId={`ackName${index}`}>
								<Form.Label>Name</Form.Label>
								<div className="d-flex align-items-start gap-2">
								    <Form.Control name="names" value={name} onChange={(e)=>handleIndexChange("ack_name", index, e, idx)} aria-label="Acknowledgment Name" />
								    <Button variant="btn btn-icon" onClick={()=>removeDocumentAckName(index, idx)}><i className="fas fa-trash" title="Remove Acknowledgment Name"></i></Button>
								</div>
							    </Form.Group>
							))}
							<Button size="sm" variant="primary" onClick={()=>addDocumentAckName(index)}>Add Name</Button>

						    </Col>
						    <Col lg={5} sm={10} md={5}>
							 <Form.Group className="mb-3" controlId={`ackOrganization${index}`}>
                                                            <Form.Label>Organization</Form.Label>
                                                            <Form.Control name="organization" value={element.organization} onChange={(e)=>handleIndexChange("ack_org", index, e)} aria-label="Acknowledgment Organization" />
                                                         </Form.Group>
						    </Col>
						    <Col lg={2} sm={2} md={2}>
							<Form.Label>Remove</Form.Label><br/>
							<Button variant="btn btn-icon" onClick={() => removeAck(index)}><i className="fas fa-trash" title="Remove Acknowledgment"></i></Button>
						    </Col>
						</Row>
						<Row>
						    <Col lg={12}>
							<Form.Group className="mb-3" controlId={`ackSummary${index}`}>
                                                            <Form.Label>Summary</Form.Label>
                                                            <Form.Control name="summary" value={element.summary} onChange={(e)=>handleIndexChange("ack_summary", index, e)} aria-label="Acknowledgment Summary" />
                                                        </Form.Group>
						    </Col>
						</Row>

					    </div>
					))}
				    </Col>

                                    <Col lg={4} md={4} sm={4}>
                                        <div className="float-end">
                                                  <Toast
                                                      bg={showToast.bg}
                                                      onClose={() =>
                                                          setShowToast({ show: false, type: "save" })
                                                      }
                                                      show={showToast.show && showToast.type == "acks"}
                                                  >
                                                      <Toast.Body>{showToast.msg}</Toast.Body>
                                                  </Toast>
                                              </div>
                                          </Col>
                                    </Row>
				<Button size="sm" variant="primary" onClick={()=>addDocumentAck()}>Add Acknowledgment</Button>
			    </Card.Body>
			    <Card.Footer>
                                <div className="d-flex align-items-center gap-2">
                                    <Button variant="secondary" onClick={()=>fetchInitialData()}>Cancel</Button>
                                    <Button variant="primary" onClick={()=>saveSettings()}>Save</Button>
                                </div>
                            </Card.Footer>
			</Card>
		    </Tab.Pane>
		</Tab.Content>
	    </Tab.Container>
	</>

    )


}


export default CSAFSettings;
