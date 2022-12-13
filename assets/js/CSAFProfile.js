import React, { useRef, useState, useEffect, useCallback } from 'react';
import {Card,Toast, Tab, Nav, DropdownButton, Dropdown, InputGroup, Form, Row, Col, Table, Accordion, Alert, Button} from 'react-bootstrap';
import { format, formatDistance } from 'date-fns'
import {useParams, useNavigate, Link, useLocation} from "react-router"
import AdminAPI from "./AdminAPI";


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

const REF_CATEGORY= [
    "self",
    "external"
]

const adminapi = new AdminAPI();

const CSAFProfile = () => {


    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(location.state?.profile);
    const [edit, setEdit] = useState(location.state?.edit || null);
    const [clone, setClone] = useState(location.state?.clone || null);
    const [error, setError] = useState(null);
    const [csafSettings, setCSAFSettings] = useState({publisher: {category: 'coordinator', contact_details: '', issuing_authority: '', name: '', namespace: ''}, id: '', lang: 'en-US', distribution: {tlp: {label: 'WHITE'}}});
    const [documentNotes, setDocumentNotes] = useState([]);
    const [documentReferences, setDocumentReferences] = useState([]);
    const [userInput, setUserInput] = useState({doc: false, notes: false, docid: false})
    const [docIdFormat, setDocIdFormat] = useState("");
    const [activeTab, setActiveTab] = useState("doc")

    const [showToast, setShowToast] = useState({
        show: false,
        msg: "",
        type: "",
	bg: "success"
    });


    const fetchInitialData = async () => {
	if (edit) {
	    setCSAFSettings({publisher: edit.publisher_settings, lang: edit.lang, id: edit.id,  distribution: {tlp: {label: edit.distribution_tlp}}});
	    setDocumentNotes(edit.notes);
	    setDocumentReferences(edit.references || []);
	    setDocIdFormat(edit.document_id || "");
	    console.log(edit);
	} else if (clone) {
	    console.log(clone);
	    setCSAFSettings({publisher: clone.publisher_settings, lang: clone.lang, distribution: {tlp: {label: clone.distribution_tlp}}});
            setDocumentNotes(clone.notes);
	    setDocumentReferences(clone.references || []);
	    setDocIdFormat(clone.document_id || "");
	    setUserInput({...userInput, doc: true})
	} else {
	    /* this is a new one and user should save settings before doing anything else */
	    setUserInput({...userInput, doc: true});
	}
    }

    useEffect(() => {
	console.log(profile);
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
	}

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
	    formDataObj['name'] = profile;
	    formDataObj['distribution_tlp'] = csafSettings.distribution.tlp.label;
	    formDataObj['doc_id'] = csafSettings.id;
	    formDataObj['lang'] = csafSettings.lang;
	    formDataObj['publisher_settings'] = csafSettings.publisher;
	    setUserInput({...userInput, doc: false})
	} else if (activeTab == "notes") {
	    formDataObj['notes'] = documentNotes;
	    setUserInput({...userInput, notes: false})
	} else if (activeTab == "refs") {
            formDataObj['references'] = documentReferences;
            setUserInput({...userInput, refs: false})
	} else if (activeTab == "docid") {
	    formDataObj['document_id'] = docIdFormat;
	    setUserInput({...userInput, docid: false})
	}

	if (clone) {
	    /* save any notes as well */
	    formDataObj['notes'] = documentNotes;
	    formDataObj['references'] = documentReferences;
	    formDataObj['docid'] = docIdFormat;
	}

	console.log(formDataObj);

	if (edit) {
	    console.log("IN EDIT!!!");
	    await adminapi.editCSAFProfile(edit.id, formDataObj).then((response) => {
		setShowToast({
                    show: true,
                    msg: "Got it! Your changes have been saved!",
                    type: activeTab,
                    bg: "success"
		});

            }).catch((err) => {
		console.log(err);
		setShowToast({
                    show: true,
                    msg: "An error occurred.",
                    type: activeTab,
                    bg: "danger"
		});
            });
	} else {
	    await adminapi.createCSAFProfile(formDataObj).then((response) => {
		/* now we're in edit mode so we can add notes/edit/etc */
		setClone(null);
		setEdit(response);
		setCSAFSettings({publisher: response.publisher_settings, lang: response.lang, id: response.id,  distribution: {tlp: {label: response.distribution_tlp}}});
		setDocumentNotes(response.notes);
		setShowToast({
                    show: true,
                    msg: "Got it! Your changes have been saved!",
                    type: activeTab,
		    bg: "success"
		});

	    }).catch((err) => {
		console.log(err);
		setShowToast({
		    show: true,
		    msg: "An error occurred.",
		    type: activeTab,
		    bg: "danger"
		});
	    });
	}

    }

    const setActiveTabNow = (tab) => {

	if (activeTab == "doc" && userInput.doc) {
	    setShowToast({
		show: true,
		msg: "Save settings before adding/editing CSAF notes",
		type: "doc",
		bg: "warning"
	    });
	} else {
	    setActiveTab(tab);
	}

    }



    const handleChange = (e) => {
	let formname = e.target.name
	const {name, value} = e.target;


	if (name === "name") {
	    setProfile(value);
	} else if (name.startsWith("publisher")) {
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
        setDocumentNotes([...documentNotes, {'category': 'description', 'text': [], 'title': ''}])
    }

    const addDocumentReference = () => {
        setDocumentReferences([...documentReferences, {summary: '', url: '', category: 'external'}])
    }

    return (
	<>
            <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Settings /</span> <Link to={'..'}>CSAF Settings</Link> / Profile</h4>


	    <Tab.Container
		defaultActiveKey="doc"
		activeKey = {activeTab}
		className="mb-3"
		onSelect={setActiveTabNow}
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
		    <Nav.Item key="docid">
			<Nav.Link eventKey="docid">Document ID {userInput.docid && <i title="Save required" className="fas fa-exclamation-triangle warningtext"></i>}</Nav.Link>
		    </Nav.Item>
		</Nav>
		<Tab.Content id="csaf-settings" className="p-0">
                    <Tab.Pane eventKey="doc" key="doc">
			<Card className="mb-4">
			    <Card.Header as="h5">
				<Card.Title>Document Settings</Card.Title>
			    </Card.Header>
			    <Card.Body>
				<Row className="mb-3">
				    <Col lg={8} md={8} sm={8}>

					<Form.Group className="mb-3">
                                            <Form.Label>Profile Name</Form.Label>
					    <Form.Control name="name" value={profile} onChange={(e)=>handleChange(e)} aria-label="CSAF Profile Name" />
					</Form.Group>

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
					    <Form.Control name="publisher.contact_details" value={csafSettings.publisher.contact_details} onChange={(e)=>handleChange(e)} aria-label="Publisher Contact Details" />
					</Form.Group>
					<Form.Group className="mb-3">
                                            <Form.Label>Publisher Issuing Authority</Form.Label>
                                            <Form.Control name="publisher.issuing_authority" value={csafSettings.publisher.issuing_authority} onChange={(e)=>handleChange(e)} aria-label="Publisher Issuing Authority" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <Form.Label>Publisher Name</Form.Label>
					    <Form.Control name="publisher.name" value={csafSettings.publisher.name} onChange={(e)=>handleChange(e)} aria-label="Publisher Name" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <Form.Label>Publisher Namespace</Form.Label>
					    <Form.Control name="publisher.namespace" value={csafSettings.publisher.namespace} onChange={(e)=>handleChange(e)} aria-label="Publisher Namespace" />
					</Form.Group>
					<Form.Group className="mb-3">
					    <Form.Label>Document Language</Form.Label>
					    <Form.Control name="lang" value={csafSettings.lang} onChange={(e)=>handleChange(e)} aria-label="Document language" />
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
					    <Form.Group className="mb-3">
						<Form.Label>Note Category</Form.Label>
						<Form.Select name="category" value={element.category} onChange={(e)=>handleIndexChange("note", index, e)} aria-label="Note Category">
						    {NOTE_CATEGORY.map((choice) => (
							<option key={choice} value={choice}>{choice} </option>
						    ))}
						</Form.Select>
					    </Form.Group>
					    <Button variant="danger" size="sm" onClick={() => removeDocNote(index)}><i className="fas fa-trash"></i> Remove Note</Button>
					</div>

					<Form.Group className="mb-3">
					    <Form.Label>Note Title</Form.Label>
                                            <Form.Control name="title" value={element.title} onChange={(e)=>handleIndexChange("note", index, e)} aria-label="Note Title" />
					</Form.Group>
					<Form.Group className="mb-3">
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
                        <Card className="mb-4">
                            <Card.Header as="h5">
                                <Card.Title>Document References</Card.Title>
                            </Card.Header>
                            <Card.Body>
				<p>Use <b>&#123;&#123;doc_id&#125;&#125;</b> as a placeholder for any references that should be generated from case Document ID.</p>

				<Row>
				    <Col lg={8} md={8} sm={12}>
				{documentReferences.map((element, index) => (
				    <div key={`documentRef-${index}`} className="border-bottom py-2 mb-2">
					<div className="d-flex align-items-center gap-4">
					<Form.Group className="mb-3">
                                            <Form.Label>Reference Category</Form.Label>
					    <Form.Select name="category" value={element.category} onChange={(e)=>handleIndexChange("ref", index, e)} aria-label="Reference Category">
                                                {REF_CATEGORY.map((choice) => (
                                                    <option key={choice} value={choice}>{choice} </option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                            <Button variant="danger" size="sm" onClick={() => removeDocRef(index)}><i className="fas fa-trash"></i> Remove Note</Button>
					</div>

					<Form.Group className="mb-3">
					    <Form.Label>Reference URL</Form.Label>
					    <Form.Control name="url" value={element.url} onChange={(e)=>handleIndexChange("ref", index, e)} aria-label="Reference URL" />
					</Form.Group>
					<Form.Group className="mb-3">
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
				    <Button size="sm" variant="primary" onClick={()=>addDocumentReference()}>Add Reference</Button>

			    </Card.Body>
			    <Card.Footer>
                                <div className="d-flex align-items-center gap-2">
                                    <Button variant="secondary"  onClick={()=>fetchInitialData()}>Cancel</Button>
                                    <Button variant="primary"  onClick={()=>saveSettings()}>Save</Button>
                                </div>
                            </Card.Footer>
			</Card>
		    </Tab.Pane>
		    <Tab.Pane eventKey="docid" key="docid">

			<Card className="mb-4">
                            <Card.Header as="h5">
                                <Card.Title>Document ID Format</Card.Title>
                            </Card.Header>
                            <Card.Body>
				<Row>
				    <Col lg={6}>
					<Form.Group className="mb-3">
					    <Form.Label>Format</Form.Label>
					    <Form.Text>
						You may use any of the following in the format, however the placeholders marked with <b>*</b> will remain until the advisory is published.
						<ul>
						    <li>YY - 2 digit year</li>
						    <li>YYYY - 4 digit year</li>
						    <li>JJJ* - Julian date (Day of Year 001-365)</li>
						    <li>NN* - sequential number of all published CSAFs within the year</li>
						</ul>
					    </Form.Text>
					    <Form.Control name="url" value={docIdFormat} onChange={(e)=>setDocIdFormat(e.target.value)} aria-label="CSAF Document ID Format" placeholder="e.g. VA-YY-JJJ-NN" />
					</Form.Group>
				    </Col>
				    <Col lg={6}>
					<div className="float-end">
                                            <Toast
                                                bg={showToast.bg}
                                                onClose={() =>
                                                    setShowToast({ show: false, type: "save" })
                                                }
                                                show={showToast.show && showToast.type == "docid"}
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
                                    <Button variant="primary"  onClick={()=>saveSettings()}>Save</Button>
                                </div>
                            </Card.Footer>
			</Card>
		    </Tab.Pane>
		</Tab.Content>
	    </Tab.Container>
	</>

    )


}


export default CSAFProfile;
