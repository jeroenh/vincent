import React, { useState, useEffect, useRef } from 'react';
import CaseThreadAPI from 'Components/ThreadAPI';
import {useParams, useNavigate} from "react-router";
import {Table, ButtonGroup,Stack, Card, Badge, DropdownButton, Dropdown, Alert, Accordion, Row, Col, Button, Form} from 'react-bootstrap';
import AdminAPI from 'Components/AdminAPI'
import CWETypeahead from "Components/CWETypeahead";
import AddCweModal from "Components/AddCweModal";
import SimpleCVSSv4App from "Components/CVSS/SimpleCVSSv4App";
import ReCAPTCHA from "react-google-recaptcha";
import { Turnstile } from '@marsidev/react-turnstile'

const recaptchaRef = React.createRef();

import '../../css/casethread.css';

const adminapi = new AdminAPI();
const threadapi = new CaseThreadAPI();

let appConfig = {};
try {
        appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const RECAPTCHA_SITE_KEY = appConfig.recaptcha_site_key || null;
const TURNSTILE_SITE_KEY = appConfig.turnstile_site_key || null;


const QUESTIONS = [
    {name: "title", question: "Report Title", required: true},
    {name: "product", question: "Vulnerable product or software?", required: true},
    {name: "vendor_contact", question: "Vendor or Developer name", required: true},
    {name: "notified", question: "Have you tried to notify affected vendors or developers?", required: true},
    {name: "disclosure_plans", question: "Do you intend to publicly disclose this vulnerability?", required: true},
    {name: "disclosure_details", question: "What are your disclosure plans?", required: false},
    {name: "cve_assignment", question: "How do you intend to assign CVEs?", required: false},
    {name: "name", question: "Please provide your name.", required: false, priv: true},
    {name: "email", question: "Please provide your email.", required: false, priv: true},
]

const VUL_QUESTIONS = [
    {name: "description", question: "Please describe the vulnerability."},
    {name: "cwes", question: "Please identify any CWEs."},
    {name: "cvss", question: "Add CVSS V4.0 Base Metrics"},
    {name: "disclosed", question: "Has this vulnerability been publicly disclosed?"},
    {name: "references", question: "Please provide evidence of public disclosure."},
    {name: "active_exploitation", question: "Are you aware of active exploitation?"},
    {name: "exploit_proof", question: "Please provide evidence of active exploitation."},
]


const CustomCisaReport = (props) => {

    const { id } = useParams();
    const navigate = useNavigate();
    const [input, setInput] = useState({title: '', product: '', vendor_contact: '', notified: '', disclosure_plans: '', disclosure_details: '', cve_assignment: '', email: '', name: ''});
    const [vuls, setVuls] = useState([{description: '', cwes: [], showCvss: "", cvss: '', disclosed: '', references: '', active_exploitation: '', exploit_proof: ''}]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [invalidInput, setInvalidInput] = useState([]);
    const [invalidVuls, setInvalidVuls] = useState([{field: '', msg: ''}]);
    const [buttonDisabled, setButtonDisabled] = useState(false);
    const [showDisplayCweModal, setShowDisplayCweModal] = useState(false);
    const [existingReport, setExistingReport] = useState(false);
    const cvssRefs = useRef({});

    const cancelForm = (e) => {
	e.preventDefault();

	if (props.edit) {
	    window.location=`/cvdp/cases/${id}`;
	} else {
	    window.location = "/cvdp/reports/";
	}
	
    }

    const callbackRef = (node) => {
	if (node) {
	    let x = node.getVulIndex();
	    cvssRefs.current[x] = node;
	}
    }
    
    const showCweSearch = () => {
        setShowDisplayCweModal(true);
    }

    const hideCweSearch = (index, selected=null) => {
        setShowDisplayCweModal(false);

        if (selected) {
            let pts = [...vuls]

            selected.forEach(x => {
                if (!vuls[index]["cwes"].includes(x)) {
		    if (pts[index]["cwes"].length < 6) {
			pts[index]["cwes"].push(x);
		    } else {
			let iv = [...invalidVuls];
			iv[index]["field"] = "cwes";
			iv[index]["msg"] = "Max limit of 5 CWEs"
			setInvalidVuls[iv];
			console.log("alert to user that more than 5 were chosen");
		    }
                }
            });
	    setVuls[pts];

        }
    }
    
    const addVulnerability = () => {
	if (vuls.length < 20) {
	    setVuls([...vuls, {description: '', cwe: '', cvss: '', disclosed: '', references: '', active_exploitation: '', exploit_proof: '', showCvss: ''}]);
	    setInvalidVuls([...invalidVuls, {field: '', msg: ''}]);

	}
    }


    const cloneVul = (i) => {
        /* do a deep clone */
        let clonedVersion = JSON.parse(JSON.stringify(vuls[i]));
        setVuls([...vuls, clonedVersion])
        setInvalidVuls([...invalidVuls, {field: '', msg: ''}])
    }

    const removeVul = (i) => {
	let newFormValues = [...vuls];
	newFormValues.splice(i, 1);
	setVuls(newFormValues);

	let newError = [...invalidVuls];
	newError.splice(i, 1);
	setInvalidVuls(newError);
    }


    const handleChange = (e) => {
	const {name, value } = e.target
	setInput(t => ({...t, [name]: value}));
    }

    const handleVulChange = (index, e) => {

	let formname = e.target.name.split("-")[0];

        let newFormValues = [...vuls];
        newFormValues[index][formname] = e.target.value;
        setVuls(newFormValues);

    }

    const doSetCWEs = (index, e) => {
	let newFormValues = [...vuls];
        newFormValues[index]["cwes"] = e;
        setVuls(newFormValues);
    }

    const doSetCVSS = (e, index) => {
        let newFormValues = [...vuls];
        newFormValues[index]["cvss"] = e;
        setVuls(newFormValues);
    }

    const validateVul = (index) => {
	let msg = "";
	const element = vuls[index];
	const errors = invalidVuls;

	if (element.description.length == 0) {
	    msg = 'Description is required';
	    errors[index].field = "description";
	} else if (element.disclosed.length == 0) {
	    msg = 'This question is required';
	    errors[index].field = "disclosed";
	}

	if (msg) {
	    errors[index].msg = msg;
	    setInvalidVuls(errors);
	} else {
	    errors[index].msg = "";
	    errors[index].field = "";
	    setInvalidVuls(errors);
	}

    }


    useEffect(() => {

	if (invalidInput.length > 0 || invalidVuls.length > 0) {
	    const el = document.querySelector('.is-invalid');
            el?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}

    }, [invalidInput, invalidVuls]);


    const fetchInitialData = async () => {
        try {
            await threadapi.getCase({'case': id}).then(async (response) => {
		if (response.report?.report) {
		    let edit_input = input;
		    setExistingReport(true);
		    response.report.report.forEach(ques => {
			if (ques.question === "Describe the vulnerabilities") {
			    let edit_vuls = [];
			    let invalid_vuls = [];
			    ques.answer.forEach(x => {
				edit_vuls.push(JSON.parse(JSON.stringify(vuls[0])));
				invalid_vuls.push({'field': '', 'msg': ''});
			    });
			    if (invalid_vuls.length > 0) {
				setInvalidVuls(invalid_vuls);
			    }
			    ques.answer.forEach((v, index) => {
				v.forEach(qa => {
				    let q = VUL_QUESTIONS.find(y => qa.question === y.question);
				    if (q) {
					if (q.name === "cvss") {
					    edit_vuls[index]['showCvss'] = "Yes";
					}
					edit_vuls[index][q.name] = qa.answer;
				    }   
				});
			    });
			    setVuls(edit_vuls);
			} else {
			    let q = QUESTIONS.find(y => y.question === ques.question);
			    if (q) {
				edit_input[q.name] = ques.answer;
			    }
			}
		    });
		    setInput(edit_input);
		}
		setLoading(false);
		console.log(response);
	    }).catch(err => {
		setError(`An error occurred: ${err.message}`);
		console.log(err);
	    });
	} catch(err) {
	    setError(`An error occurred: ${err.message}`);
	    console.log(err);
	}
    }

    useEffect(() => {

	setExistingReport(false);
	if (props.edit) {
	    fetchInitialData();
	} else {
	    const username = document.getElementById('user_auth_name')?.textContent;
	    const email = document.getElementById('user_auth_email')?.textContent;
	    if (username) {
		setInput(t => ({...t, name: username}));
	    }
	    if (email) {
		setInput(t => ({...t, email: email}));
	    }
	    setLoading(false);
	}
	
    }, []);


    const submitReport = async (event) => {
	let error = false;
        //setErrorMessage(null);
        event.preventDefault();
	let report = [];

	const report_id = document.getElementById('report_id')?.textContent;
	
	const formData = new FormData(event.target),
              formDataObj = Object.fromEntries(formData.entries());
	
	const invalid_input = [];

	vuls.forEach((item, index) => validateVul(index));

	const vuls_invalid = invalidVuls.filter((item) => item.field != '')

	if (vuls_invalid.length > 0) {
	    error = true;
	}

	Object.keys(input).forEach(q => {

	    let ques = QUESTIONS.find(y => y.name === q);
	    if (ques.required && !input[q]) {
		invalid_input.push(ques.name);
	    }
	    if (input[q] && ques.priv) {
		report.push({question: ques.question, answer: input[q], priv: true});
	    } else if (input[q]) {
		report.push({question: ques.question, answer: input[q]});
	    }

	});

	if (input.disclosure_plans === "Yes" && !input.disclosure_details) {
	    invalid_input.push("disclosure_details");
	}

	if (invalid_input.length > 0) {
	    setInvalidInput(invalid_input);
	    return;
	}

	if (vuls_invalid.length > 0) {
	    return ;
	}

	let vuls_report = []

	vuls.forEach(v => {
	    let v_report = [];
	    Object.keys(v).forEach(q => {
		if (v[q]) {
		    let ques = VUL_QUESTIONS.find(y => q.includes(y.name));
		    if (q === "cwes") {
			let newcpes = v[q].map(x => x.cwe);
			if (newcpes.length > 0) {
			    v_report.push({question: ques.question, answer: newcpes});
			}
		    } else if (ques) {
			v_report.push({question: ques.question, answer: v[q]});
		    }
		}

	    });
	    vuls_report.push(v_report);
	});


	report.push({question: "Describe the vulnerabilities", answer: vuls_report});

	let data = new FormData();

	if (formDataObj.poc && formDataObj.poc.size > 0) {
	    data.append('poc', formDataObj.poc);
	    report.push({question: 'Provide a supporting file', answer: formDataObj.poc.name}); 
	}
	
	let rep = JSON.stringify(report);
	data.append('report', rep);
	
	if (report_id) {
	    data.append('report_id', report_id);
	}
	
        if (RECAPTCHA_SITE_KEY) {
            const token = await recaptchaRef.current.executeAsync();
            data.append('token', token);
        } else if (TURNSTILE_SITE_KEY) {
	    const token = await recaptchaRef.current?.getResponse();
	    data.append('token', token);
	}

	if (props.edit) {
	    await adminapi.editReport(id, data).then((response) => {
		window.location=`/cvdp/cases/${id}`;
	    }).catch(err => {
		setError(`An error occurred: ${err.message}`);
		const el = document.getElementById("customcisaform");
		el?.scrollIntoView({ behavior: 'smooth'});
		console.log(err);
	    });
	    
	} else {
	    await adminapi.submitReport(data).then((response) => {
		window.location="/cvdp/reports/";
	    }).catch(err => {
		
		let msg = err.response?.data?.detail;
		if (msg) {
		    setError(`An error occurred: ${msg}`);
		} else {
		    setError(`An error occurred: ${err.message}`);
		}
		const el = document.getElementById("customcisaform");
		el?.scrollIntoView({ behavior: 'smooth' });
		console.log(err);
	    });
	}


    }


    return (
	<div id="customcisaform">
	    {props.edit ?
	     <>
		 {existingReport &&
		  <div className="alert alert-warning">By editing this report, a copy of the original report will remain in tact and will be available to case coordinators. All other case participants will only see the edited copy.</div>
		 }
	     </>

	     :
		 <Card className="mb-3">
		     <Card.Body>
			 <p className="lead">
			     Please be direct and concise. Consider that we, and any
			     parties we notify,
			     will try to independently confirm the vulnerability, or at least gather
			     enough evidence to support the existence of the vulnerability. When
			     reporting multiple vulnerabilities, please be clear about the
			     differences between individual vulnerabilities, even if they are used
			     in combinations or the same or similar vulnerability exists in
			     multiple products or software components.
			 </p>
			 <p className="lead">
			     We appreciate proof-of-concept code and clear steps to
			     independently confirm the vulnerability. Video and screen shots
			     may be helpful but are usually not sufficient by themselves.
			     Large outputs from debugging or automated analysis tools are
			     usually not necessary or helpful.
			 </p>
			 <p className="lead">
			     Your submission is subject to the CISA/CVD/VINCE-NT/platform terms
			     and conditions. Your identity on the platform and any materials
			     you submit in this report may be shared with other parties at our
			     discretion in order to coordinate vulnerability disclosure.
			     If you wish to retain some degree of anonymity, we suggest
			     using an account that does not clearly identify you.
			 </p>
		     </Card.Body>
		 </Card>
	    }
	    {error &&
	     <div className="alert alert-danger" id="errormsg">{error}</div>
	    }
	    

	    {loading ?
	     <div className="text-center">
                 <div className="lds-spinner"><div></div><div></div><div></div></div>
             </div>
             :


	    <Form onSubmit={(e)=>submitReport(e)} id="statusform">
		<Card>
		    <Card.Body>

			<Form.Group className="mb-3" controlId="titleInput">
			    <Form.Label as="h6"  className="mb-0">Report Title <span className="required">*</span></Form.Label>
			    <Form.Text>
				Give your report a short title. <i>(e.g. Buffer Overflow in Bar Project Libfoo 1.2.5)</i>
			    </Form.Text>
			    <Form.Control name="title"
					  title="Provide a title for your report"
					  value={input.title}
					  onChange={(e)=>handleChange(e)}
					  isInvalid={invalidInput.includes('title')}
			    />
			    {invalidInput.includes('title') &&
			     <Form.Text className="error">
				 Report Title is required. Enter a short descriptive title.
			     </Form.Text>
			    }

			</Form.Group>

			<Form.Group className="mb-3" controlId="projectInput">
			    <Form.Label as="h6" className="mb-0">Vulnerable Project or Software <span className="required">*</span></Form.Label>
			    <Form.Text>
				Identify the vulnerable product or software using
				information such as vendor or developer name,
				product or project name, versions, and dates.
				If appropriate, identify multiple vendors,
				developers, products, and projects.
				<i>(e.g. libfoo 1.2.5 from the Bar Project )</i>
			    </Form.Text>
			    <Form.Control name="product" as="textarea" value={input.product}
					  onChange={(e)=>handleChange(e)}
					  title="Identify vulnerability project or software"
			    		  isInvalid={invalidInput.includes('product')}/>
			    {invalidInput.includes('product') &&
			     <Form.Text className="error">
				 Project or Software name is required. Please add the name of the vulnerable project, product, or software.
			     </Form.Text>
			    }

			</Form.Group>
			<Form.Group className="mb-3" controlId="notifyInput">
			    <Form.Label as="h6">Have you tried to notify affected vendors or developers? <span className="required">*</span>
			    </Form.Label>
			    <div>
			    <Form.Check
				inline
				label={"Yes"}
				id="notifyInput-Yes"
				aria-label={"Yes, affected vendors have been notified"}
				name="notified"
				isInvalid={invalidInput.includes('notified')}
				checked = {input.notified === "Yes" ? true : false }
				value={"Yes"}
				onChange={(e)=>handleChange(e)}
				type="radio"
			    />
			    <Form.Check
				inline
				label={"No"}
				id="notifyInput-No"
				aria-label={"No, affected vendors have not been notified"}
				name="notified"
				isInvalid={invalidInput.includes('notified')}
				checked = {input.notified === "No" ? true : false }
				value={"No"}
				onChange={(e)=>handleChange(e)}
				type="radio"
			    />
			    </div>
			    {invalidInput.includes('notified') &&
			     <Form.Text className="error">
				 Answer required. Please let us know if you have tried to notify the affected vendors or developers.
			     </Form.Text>
			    }

			</Form.Group>
			<Form.Group controlId="vendorInput">
			    <Form.Label as="h6" className="mb-0">Vendor or Developer Information <span className="required">*</span></Form.Label>
			    <Form.Text>Provide any vendor or developer contact information and describe your communications with them. If appropriate, identify multiple vendors or developers. <i>(e.g. psirt@example.com, example.com/security, example.org/BarProject/security)</i>
			    </Form.Text>
			    <Form.Control as="textarea"  name="vendor_contact"
					  title="Provide vendor or developer contact information"
					  isInvalid={invalidInput.includes('vendor_contact')}
					  value={input.vendor_contact} onChange={(e)=>handleChange(e)}/>
			    {invalidInput.includes('vendor_contact') &&
			     <Form.Text className="error">
				 Vendor or Developer Information Required. Please provide contact information or a description of previous communications.
			     </Form.Text>
			    }

			</Form.Group>

		    </Card.Body>

		    <Card.Header as="h5" className="pt-0">
			<Card.Title>Vulnerabilities</Card.Title>
			<Card.Subtitle>Describe one or more vulnerabilties. You may enter multiple vulnerabilities, up to 20.
			Please be clear about the distinction between the vulnerabilities.</Card.Subtitle>

		    </Card.Header>
		    <Card.Body>
			{vuls.map((element, index) => (
			    <div key={`vul-${index}`} className="border-top border-bottom py-2 mb-2">
				    {vuls.length > 0 &&
				     <div className="d-flex align-items-center justify-content-between">
					 <Form.Label as="h6">
					     <b>Vulnerability {index + 1}</b>
					 </Form.Label>
					 <ButtonGroup>
					     <Button onClick={(e)=>cloneVul(index)} variant="outline-primary" title="Clone Vulnerability" size="sm">Clone</Button>
					     {vuls.length > 1 &&
					      <Button onClick={(e)=>removeVul(index)} variant="outline-danger" size="sm" title="Remove Vulnerability">Remove</Button>
					     }
					 </ButtonGroup>
				     </div>
				    }
				<Form.Group className="mb-3" controlId={`vulDesc-${index}`}>
				    
				    <Form.Label as="h6" className="mb-0">Description <span className="required">*</span></Form.Label>
				    
				    <Form.Text>
					Describe the vulnerability, including how to independently confirm your
					findings (how to exploit the vulnerability) and the security impact
					(gain to the attacker, loss to the victim). Please provide or
					attach proof-of-concept code and other documentation
					(for example, an existing report, paper, or write-up).
					We appreciate CVSS and CWE information, but note that we (and other parties)
					typically perform our own CVSS and CWE analysis.
				    </Form.Text>
				    <Form.Control name="description" as="textarea"
						  aria-label="Vulnerability Description"
						  isInvalid={invalidVuls[index]?.field == "description"}
						  value={element.description} onChange={(e)=>handleVulChange(index, e)}/>
				    {invalidVuls[index].field == "description" &&
                                     <Form.Text className="error">
					 Vulnerability Description required.
                                     </Form.Text>
				    }
				</Form.Group>

				<Form.Group className="mb-3" controlId={`vulCWE${index}`}>
				    <div className="align-items-center d-flex gap-1 mb-0">
					<Form.Label as="h6" className="mb-0">CWE</Form.Label>
					<Button
					    onClick={(e) => showCweSearch()}
					    variant="btn-icon"
					    className="px-1"
					>
					    <i className="fas fa-search px-1" title="Search for Relevant CWE"></i>
					</Button>
				    </div>
				    <Form.Text className="mt-0">
					Select one or more relevant CWE IDs (up to 5).
				    </Form.Text>
				    <AddCweModal
					showModal={showDisplayCweModal}
					hideModal={(e)=>hideCweSearch(index, e)}
				    />
				    <CWETypeahead
					cwes={element.cwes}
					setCWEs={(e)=>doSetCWEs(index, e)}
				    />
				</Form.Group>

				<Form.Group className="mb-3" controlId={`vulCVSS${index}`}>
				    <Form.Label as="h6" className="mb-0">Would you like to add a CVSS score for this vulnerability?</Form.Label>
				    <Form.Text>You may optionally provide a CVSS score.</Form.Text>
				    <div>
					<Form.Check
					    inline
					    label={"Yes"}
					    aria-label={"Add a CVSS Score"}
					    id="showCvss-${index}-YES"
					    name={`showCvss-${index}`}
					    checked = {element.showCvss === "Yes" ? true : false }
					    value={"Yes"}
					    onChange={(e)=>handleVulChange(index, e)}
					    type="radio"
					/>
					<Form.Check
					    inline
					    label={"No"}
					    id="showCvss-No"
					    aria-label={"Do not add a CVSS Score"}
					    name={`showCvss-${index}-${index}`}
					    checked = {element.showCvss === "No" ? true : false }
					    value={"No"}
					    onChange={(e)=>handleVulChange(index, e)}
					    type="radio"
					/>
				    </div>
				</Form.Group>
				{element.showCvss === "Yes" &&
				 <Form.Group className="mb-3" controlId={`vulcvss${index}`}>
				     <SimpleCVSSv4App
					 ref={callbackRef}
					 cvss = {element.cvss}
					 vulid = {index}
					 setCvss={(e)=>doSetCVSS(e, index)}
				    />
				</Form.Group>
				}

				<Form.Group className="mb-3" controlId={`vulDisclosed${index}`}>
				    <Form.Label as="h6" className="mb-0">Has this vulnerability been publicly disclosed? <span className="required">*</span>
				    </Form.Label>
				    <Form.Text>To your knowledge, has this vulnerability been publicly disclosed?</Form.Text>

				    <Form.Check
					inline
					label={"Yes"}
					aria-label={"Vulnerability has been publicly disclosed"}
					id="disclosed-${index}-yes"
					name={`disclosed-${index}`}
					isInvalid={invalidVuls[index].field === "disclosed"}
					checked = {element.disclosed === "Yes" ? true : false }
					value={"Yes"}
					onChange={(e)=>handleVulChange(index, e)}
					type="radio"
				    />
				    <Form.Check
					inline
					label={"No"}
					aria-label={"Vulnerability has not been publicly disclosed"}
					id="disclosed-${index}-no"
					name={`disclosed-${index}`}
					isInvalid={invalidVuls[index].field === "disclosed"}
					checked = {element.disclosed === "No" ? true : false }
					value={"No"}
					onChange={(e)=>handleVulChange(index, e)}
					type="radio"
				    />
				    {invalidVuls[index].field == "disclosed" &&
                                     <Form.Text className="error">
					 This question is required. Please let us know if this vulnerability is public.
                                     </Form.Text>
				    }
				</Form.Group>

				{element.disclosed === "Yes" &&
				 <Form.Group className="mb-3" controlId={`vulRefs${index}`}>
				     <Form.Label as="h6" className="mb-0">Please provide references/evidence of public disclosure.</Form.Label>
				     <Form.Text>
				     </Form.Text>
				     <Form.Control name="references" value={element.references} as="textarea" onChange={(e)=>handleVulChange(index, e)}/>
				 </Form.Group>
				}



				<Form.Group className="mb-3" controlId={`vulExploit${index}`}>
				    <Form.Label as="h6" className="mb-0">Are you aware of active exploitation?
				    </Form.Label>
				    <Form.Text>To your knowledge, has this vulnerability been actively exploited</Form.Text>
				    <Form.Check
					inline
					label={"Yes"}
					aria-label={"Vulnerability has been actively exploited."}
					id="active_exploitation-${index}-yes"
					name={`active_exploitation-${index}`}
					checked = {element.active_exploitation === "Yes" ? true : false }
					value={"Yes"}
					onChange={(e)=>handleVulChange(index, e)}
					type="radio"
				    />
				    <Form.Check
					inline
					label={"No"}
					aria-label={"Vulnerability has not been actively exploited."}
					id="activeexploitation-${index}-yes"
					name={`active_exploitation-${index}`}
					checked = {element.active_exploitation === "No" ? true : false }
					value={"No"}
					onChange={(e)=>handleVulChange(index, e)}
					type="radio"
				    />
				</Form.Group>

				{element.active_exploitation === "Yes" &&
				 <Form.Group className="mb-3" controlId={`vulEvidenceExploit${index}`}>
				     <Form.Label as="h6" className="mb-0">Please provide references/evidence of active exploitation.</Form.Label>
				     <Form.Text>
				     </Form.Text>
				     <Form.Control name="exploit_proof" as="textarea" value={element.exploit_proof} onChange={(e)=>handleVulChange(index, e)}/>
				 </Form.Group>
				}

			    </div>
			))}
			{vuls.length < 20 &&
			 <div className="button-section mb-2">
			     <Button size="sm" variant="outline-primary" type="button"
				     onClick={() => addVulnerability()}><i className="fas fa-plus"></i> Add Additional Vulnerability</Button>
			 </div>
			}

		    </Card.Body>
		    <Card.Body className="pt-0">

			<Form.Group className="mb-3" controlId="discloseInput">
			    <Form.Label as="h6">Do you intend to publicly disclose this vulnerability? <span className="required">*</span>
			    </Form.Label>
			    <div>
				<Form.Check
				    inline
				    label={"Yes"}
				    aria-label={"Yes, I plan to disclose this vulnerability"}
				    id="disclosurePlans-yes"
				    name="disclosure_plans"
				    isInvalid={invalidInput.includes('disclosure_plans')}
				    checked = {input.disclosure_plans === "Yes" ? true : false }
				    value={"Yes"}
				    onChange={(e)=>handleChange(e)}
				    type="radio"
				/>
				<Form.Check
				    inline
				    label={"No"}
				    aria-label={"No disclosure plans"}
				    id="disclosurePlans-No"
				    name="disclosure_plans"
				    isInvalid={invalidInput.includes('disclosure_plans')}
				    checked = {input.disclosure_plans === "No" ? true : false }
				    value={"No"}
				    onChange={(e)=>handleChange(e)}
				    type="radio"
				/>
			    </div>
			    {invalidInput.includes('disclosure_plans') &&
			     <Form.Text className="error">
				 Required. Please let us know of your disclosure plans.
			     </Form.Text>
			    }

			    </Form.Group>

			{input.disclosure_plans === "Yes" &&
			 <Form.Group className="mb-3" controlId="plansInput">
			     <Form.Label as="h6" className="mb-0">Disclosure Plans <span className="required">*</span></Form.Label>
			     <Form.Text>If so, please describe your plans, including dates and conditions,
			     even if they are approximate. (e.g. <i>Yes, in 6 weeks at a conference</i>)</Form.Text>
			     <Form.Control name="disclosure_details" as="textarea"
					   isInvalid={invalidInput.includes('disclosure_details')}
					   value={input.disclosure_details} onChange={(e)=>handleChange(e)}/>
			     {invalidInput.includes('disclosure_details') &&
			      <Form.Text className="error">
				  Disclosure plans required. Please describe your plan to disclose.
			      </Form.Text>
			     }

			 </Form.Group>
			}

			<Form.Group className="mb-3" controlId="cveInput">
			    <Form.Label as="h6" className="mb-0">CVE ID Assignment</Form.Label>
			    <Form.Text>
				How do you want to assign CVE IDs? By default, CISA, or other CNAs with
				appropriate scope (typically vendor or developer CNAs) will assign.
			    </Form.Text>
			    <Form.Control name="cve_assignment" title="Provide details on CVE assignment" as="textarea" value={input.cve_assignment} onChange={(e)=>handleChange(e)}/>
			</Form.Group>

			<Form.Group controlId="formFile" className="mb-3">
                            <Form.Label as="h6" className="mb-0">Upload a File</Form.Label>
			    <Form.Text>You may upload 1 file with this report. Additional files can be added 
			    after a Case is created.</Form.Text>
                            <Form.Control  name="poc" type="file" title="Provide a file for this report"/>
			    {invalidInput.includes('poc') &&
			     <Form.Text className="error">
				 Please include a valid file.
			     </Form.Text>
			    }

			</Form.Group>

			<Form.Group controlId="formUserEmail" className="mb-3">
			    <Form.Label as="h6" className="mb-0">Email</Form.Label>
			    <Form.Text>Your email address. Consider creating a free webmail account if you do not wish to share your personal email address.</Form.Text>
			    <Form.Control name="email" title="Provide your email" value={input.email} onChange={(e)=>handleChange(e)}/>
			</Form.Group>
			
			<Form.Group controlId="formUserName" className="mb-3">
			    <Form.Label as="h6" className="mb-0">Name</Form.Label>
			    <Form.Text>Your name, pseudonym, alias, or handle.</Form.Text>
			    <Form.Control name="name" title="Provide your name" value={input.name} onChange={(e)=>handleChange(e)}/>
			</Form.Group>
			
			
			{RECAPTCHA_SITE_KEY &&
			 <ReCAPTCHA
                             ref={recaptchaRef}
                             size="invisible"
                             sitekey={RECAPTCHA_SITE_KEY}
			 />
			}         
			{TURNSTILE_SITE_KEY &&
			 <div className="mb-3">
			     <Turnstile
				 ref={recaptchaRef}
				 appearance="interaction-only"
				 siteKey={TURNSTILE_SITE_KEY}
			     />
			 </div>
			}
			
			
			<div className="d-flex align-items-start gap-3">
			    <Button variant="outline-secondary" onClick={(e)=>cancelForm(e)}>
				Cancel
			    </Button>
			    <Button variant="primary" type="submit" disabled={buttonDisabled}>
				Submit
			    </Button>
			</div>
		    </Card.Body>
		</Card>

	    </Form>
	    }


	</div>

    )


}


export default CustomCisaReport;
