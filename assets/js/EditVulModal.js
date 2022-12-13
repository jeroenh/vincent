import React from 'react';
import { Modal, OverlayTrigger, Popover, ButtonGroup, ToggleButton, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import {AsyncTypeahead, Typeahead} from 'react-bootstrap-typeahead';
import axios from 'axios';
import { useState, useRef, useCallback, useEffect } from 'react';
import { format, parse, addDays, addMinutes, isValid } from 'date-fns';
import { Calendar } from "react-date-range";
import TagTypeahead from "./TagTypeahead.js";
import VulSelection from "./VulSelection";
import VulAttributeEditor from "./VulAttributeEditor";
import CVEAPI from "./CVEAPI";
import DRFErrorMessage from './DRFErrorMessage';
import ThreadAPI from './ThreadAPI';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css';

const CACHE = {};

const PER_PAGE = 50;

const cveapi = new CVEAPI();
const threadapi = new ThreadAPI();


const CVETAGS_ENUM = ["unsupported-when-assigned", "exclusively-hosted-service", "disputed"];

const REFTAGS_ENUM = [
    "broken-link",
    "customer-entitlement",
    "exploit",
    "government-resource",
    "issue-tracking",
    "mailing-list",
    "mitigation",
    "not-applicable",
    "patch",
    "permissions-required",
    "media-coverage",
    "product",
    "related",
    "release-notes",
    "signature",
    "technical-description",
    "third-party-advisory",
    "vendor-advisory",
    "vdb-entry"
]

function makeAndHandleRequest(query, page = 1) {

    return threadapi.getCWEs(query).then((response) => {
        const items = response.results;
        const total_count = response.length;
        const options = items.map((i) => ({
            cwe: i.cwe,
            description: i.description,
            children: i.children,
            usage: i.usage,
            slice: i.slice_1003,
        }));
        return {options, total_count};

    });
}

const radios = [
    { name: 'Publish', value: true },
    { name: "Don't Publish", value: false },
];


const EditVulModal = (props) => {

    const [error, setError] = useState("");
    const [invalidCVE, setInvalidCVE] = useState(null);
    const [originalBulk, setOriginalBulk] = useState({});
    const [invalidDescription, setInvalidDescription] = useState(null);
    const [vulCVE, setVulCVE] = useState("");
    const [cveInfo, setCveInfo] = useState(null);
    const [metrics, setMetrics] = useState([]);
    const [cweFormInputs, setCWEFormInputs] = useState([]);
    const [vulDescription, setVulDescription] = useState("");
    const [vulTags, setVulTags] = useState("");
    const [cveTags, setCveTags] = useState([]);
    const [vulDate, setVulDate] = useState("");
    const [cwes, setCWEs] = useState([]);
    const [acks, setAcks] = useState([{names: ""}]);
    const [isCwesLoading, setIsCwesLoading] = useState(false);
    const [cweSelected, setCWESelected] = useState([]);
    const [references, setReferences] = useState([{url: '', summary: '', tags: []}]);
    const [title, setTitle] = useState("");
    const [tags, setTags] = useState([]);
    const [publish, setPublish] = useState(true);
    const [datePublic, setDatePublic] = useState("");
    const [userInput, setUserInput] = useState(false);
    const [alert, setAlert] = useState(null);
    const [drfError, setDRFError] = useState(null);
    const [askUserToChooseVul, setAskUserToChooseVul] = useState(false);
    const [breadCrumbs, setBreadCrumbs] = useState([]);
    const [attributes, setAttributes] = useState([]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [invalidDate, setInvalidDate] = useState(null);

    
    const handleCWESearch = (q) => {
        //console.log(q);
        if (CACHE[q]) {
            setCWEs(CACHE[q].options);
            return;
        }

        setIsCwesLoading(true);

        let query = `page_size=200&search=${q}`;
        makeAndHandleRequest(query).then((resp) => {
            CACHE[q] = { ...resp, page: 1 };
            //console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsCwesLoading(false);
            setCWEs(resp.options);
        });
    }

    const getUsageColor = (usage) => {
        switch (usage) {
        case 'Allowed':
            return 'success';
        case 'Discouraged':
            return 'warning';
        case 'Prohibited':
            return 'danger';
        default:
            return 'info';
        }
    }

    const initChooseVul = () => {
	setAskUserToChooseVul(true);
	setBreadCrumbs([...props.vul]);
    }
    
    const initBulkEdit = () => {

	let origBulk = {};
	
	let notempty = props.vul.find(x => x.original.description != "");
	if (notempty) {
	    origBulk['description'] = notempty.original.description;
	    setVulDescription(notempty.original.description);
	} else {
	    origBulk['description'] = "";
	    setVulDescription("");
	}

	notempty = props.vul.find(x => x.original.title != "");
	if (notempty) {
	    origBulk['title'] = notempty.original.title;
	    setTitle(notempty.original.title);
	} else {
	    origBulk['title'] = "";
	    setTitle("");
	}

	notempty = props.vul.find(x => x.original.cve_tags.length > 0);
	if (notempty) {
	    origBulk['cve_tags'] = JSON.parse(JSON.stringify(notempty.original.cve_tags));
	    setCveTags(notempty.original.cve_tags);
	} else {
	    origBulk['cve_tags'] = [];
	    setCveTags([]);
	}


	notempty = props.vul.find(x => x.original.problem_types?.length > 0);
	if (notempty) {
            let x = notempty.original.problem_types.map((c) => ({'cwe': c}))
	    origBulk['cwe'] = JSON.parse(JSON.stringify(notempty.original.problem_types));
	    setCWESelected(x);
	} else {
	    origBulk['cwe'] = []
            setCWESelected([]);
        }

	notempty = props.vul.find(x => x.original.references?.length > 0);
	if (notempty) {
	    origBulk['references'] = JSON.parse(JSON.stringify(notempty.original.references));
	    setReferences(notempty.original.references);
	} else {
	    origBulk['references'] = [];
	    setReferences([]);
	}

	notempty = props.vul.find(x => x.original.tags.length > 0);
	if (notempty) {
	    origBulk['tags'] = JSON.parse(JSON.stringify(notEmpty.original.tags));
	    setTags(notempty.original.tags);
	} else {
	    origBulk['tags'] = [];
	    setTags([]);
	}

	notempty = props.vul.find(x => x.original.date_public != "");
        if (notempty) {
            setDatePublic(notempty.original.date_public);
	    origBulk['date'] = notempty.original.date_public;
        } else {
            setDatePublic("");
	    origBulk['date'] = "";
        }
	notempty = props.vul.find(x => x.original.acknowledgments.length > 0);
	if (notempty) {
	    /* originally this was just a list of names but needed to add organization
	       name as well so check if this is a list of objects or strings */
	    let vulacks = notempty.original.acknowledgments.map(a => {
		if (typeof a === 'string' || a instanceof String) {
		    return {names: a}
		}
		return a
	    });
	    setAcks(vulacks);
	    origBulk['acks'] = JSON.parse(JSON.stringify(vulacks));
	} else {
            setAcks([{names: ""}]);
	    origBulk['acks'] = [{names: ""}];
        }

	origBulk['publish'] = true;
	
	setOriginalBulk(origBulk);
	
    }

    const clearFields = () => {

	setUserInput(false);
	setVulCVE("");
	setVulDescription("");
	setTitle("");
	setCveTags([]);
	setCWESelected([]);
	setReferences([]);
	setTags([]);
	setDatePublic("");
	setAcks([{names: ""}]);
	setPublish(true);
	setAttributes([]);
	
    }
	

    
    useEffect(() => {

	if (props.showModal) {
	    setError("");
	    setUserInput(false);
	    setAlert(null);
	    setDRFError(null);
	}

	if (props.vul) {
	    setUserInput(false);
	    if (Array.isArray(props.vul) && props.bulk) {
		setBreadCrumbs([]);
		initBulkEdit();
		return;
	    } else if (Array.isArray(props.vul)) {
		initChooseVul();
		return;
	    } else {
		setAskUserToChooseVul(false);
	    }

	    console.log(props.vul);
	    
	    /* check to make sure these things aren't null, otherwise react complains */
	    if (props.vul.cve) {
		setVulCVE(props.vul.vul);
	    } else {
		setVulCVE("");
	    }

	    setVulDescription(props.vul.description);
	    if (props.vul.title) {
		setTitle(props.vul.title);
	    } else {
		setTitle("");
	    }
	    if (props.vul.cve_tags) {
		setCveTags(props.vul.cve_tags);
	    }
	    if (props.vul.problem_types) {
		let x = props.vul.problem_types.map((c) => ({'cwe': c}))
		setCWESelected(x);
	    } else {
		setCWESelected([]);
	    }
	    if (props.vul.references?.length > 0) {
		setReferences(props.vul.references);
	    } else {
		setReferences([{url: "", summary: ""}]);
	    }
	    if (props.vul.tags) {
		setTags(props.vul.tags);
	    } else {
		setTags([]);
	    }
	    if (props.vul.date_public) {
		setDatePublic(props.vul.date_public);
	    } else {
		setDatePublic("");
	    }
	    setPublish(props.vul.publish);
	    if (props.vul.acknowledgments?.length > 0) {
		let vulacks = props.vul.acknowledgments.map(a => {
                    if (typeof a === 'string' || a instanceof String) {
			return {names: a}
		    }
                    return a
		});
		setAcks(vulacks);
	    } else {
		setAcks([{names: ""}]);
	    }
	} else {
	    clearFields();
	}

    }, [props]);


    const changeDate = (value, cal=true) => {
	/* this is to avoid weird timezone issues */
	setUserInput(true);

	if (cal) {
	    let d = new Date(value);
            setDatePublic(format(addMinutes(d, d.getTimezoneOffset()), 'yyyy-MM-dd'));
            setInvalidDate(null);
	    return;
	}


	if (value) {
	    const dateFormat = 'yyyy-MM-dd';
	    const parsedDate = parse(value, dateFormat, new Date());
	    if (isValid(parsedDate)) {
		let d = new Date(value);
		setDatePublic(format(addMinutes(d, d.getTimezoneOffset()), 'yyyy-MM-dd'));
		setInvalidDate(null);
	    } else {
		setDatePublic(value);
		setInvalidDate(true);
	    }
	} else {
	    setDatePublic(value);
	}
    };


    const tryReserve = () => {
	if (userInput) {
	    setAlert("Save changes before reserving CVE.");
	} else {
	    props.reserveCVE();
	}
    }


    const getBulkEditEntries = (formData) => {


	let formDataObj = {}

	console.log(originalBulk);
	console.log(formData);
	
	if (originalBulk['description'] !== formData['description']) {
	    formDataObj['description'] = formData['description'];
	}

	if (originalBulk['title'] !== formData['title']) {
	    formDataObj['title'] = formData['title'];
	}

	if (JSON.stringify(originalBulk['cve_tags']) !== JSON.stringify(formData['cve_tags'])) {
	    formDataObj['cve_tags'] = formData['cve_tags'];
	}

	if (JSON.stringify(originalBulk['cwe']) !== JSON.stringify(formData['problem_types'])) {
	    formDataObj['problem_types'] = formData['problem_types'];
	}

	if (JSON.stringify(formData['references']) !== JSON.stringify(originalBulk['references'])) {
	    formDataObj['references'] = formData['references']
	}

	if (JSON.stringify(formData['tags']) !== JSON.stringify(originalBulk['tags'])) {
	    formDataObj['tags'] = formData['tags']
	}

	if (JSON.stringify(formData['acknowledgments']) !== JSON.stringify(originalBulk['acks'])) {
	    formDataObj['acknowledgments'] = formData['acknowledgments']
	}
	if (formData['date_public'] !== originalBulk['date']) {
	    formDataObj['date_public'] = formData['date_public'];
	}

	if (formData['publish'] !== originalBulk['publish']) {
	    formDataObj['publish'] = formData['publish'];
	}
	

	return formDataObj;
    }
	    
    
    
    const submitVul = async (event) => {
        event.preventDefault();

        const error = false;
        const formData = new FormData(event.target),
              formDataObj = Object.fromEntries(formData.entries());

	formDataObj['problem_types'] = cweSelected.map((item)=> item.cwe);
	formDataObj['references'] = references.filter((item) => {
	    if (item.url) {
		return item
	    }
	});
	formDataObj['cve_tags'] = cveTags;
	formDataObj['acknowledgments'] = acks.filter((item) => {
	    if (item && (item?.names != "" || item?.organization != "")) {
		return item
	    }
	});
	formDataObj['publish'] = publish;
	formDataObj['metrics'] = metrics;
	formDataObj['title'] = title;
	let dp = new Date(datePublic);
	formDataObj['date_public'] = datePublic ? format(addMinutes(dp, dp.getTimezoneOffset()), 'yyyy-MM-dd') : '';
	formDataObj['tags'] = tags.map((item) => {
	    if (item.label) {
		return item.label;
	    } else if (item.tag) {
		return item.tag;
	    } else {
		return item;
	    }
	});
	if (attributes.length > 0) {
	    formDataObj['attributes'] = attributes;
	}

	if (formDataObj.description === "") {
            setInvalidDescription(true);
            error = true;
	    setError("Please fill in required fields.")
        } else {
            setInvalidDescription(false);
        }
	if (error == false) {
            /* else submit form */
	    if (Array.isArray(props.vul)) {

		let bulk_formDataObj = getBulkEditEntries(formDataObj);
		console.log(bulk_formDataObj);
		let axiosArray = [];
		props.vul.forEach(vul => {
		    axiosArray.push(threadapi.updateVul(vul.original, bulk_formDataObj));
		});
		try {
		    await axios.all(axiosArray);
		    props.updateVul();
		    props.hideModal();
		} catch(err) {
		    console.log(err);
		    if (err.response?.data) {
                        setDRFError(err.response.data);
                    } else {
                        setError(`Error submitting vulnerability information: ${err.reponse.data.detail}`);
                    }
		}
	    } else if (props.vul?.vul) {

		await threadapi.updateVul(props.vul, formDataObj).then((response) => {
                    /* get all questions updated */
		    props.updateVul();
		    props.hideModal();
		}).catch(err => {
                    console.log(err);
		    console.log(err.response?.data);
		    if (err.response?.data) {
			setDRFError(err.response.data);
			//setError(`Error submitting vulnerability information: ${errlist}}`);
		    } else {
			setError(`Error submitting vulnerability information: ${err.reponse.data.detail}`);
		    }
		});
	    } else {
		let res = threadapi.addVul({case_id: props.caseInfo.case_id}, formData).then(function(response) {
                    props.updateVul();
		    props.hideModal();
                }).catch(function (err) {
                    console.log(err);
		    console.log(err.response.data);
                    if (err.response?.data) {
                        setDRFError(err.response.data);
                        //setError(`Error submitting vulnerability information: ${errlist}}`);
                    } else {
                        setError(`Error submitting vulnerability information: ${err.reponse.data.detail}`);
                    }
                });
            }

        }
    }

    const removeAck = (i) => {
        let newFormValues = [...acks];
        newFormValues.splice(i, 1);
	if (newFormValues.length == 0) {
	    newFormValues = [{names: ""}];
	}
        setAcks(newFormValues);
	setUserInput(true);
    }

    const removeRef = (i) => {
        let newFormValues = [...references];
        newFormValues.splice(i, 1);
	if (newFormValues.length == 0) {
	    newFormValues = [{url: "", summary: ""}];
	}
        setReferences(newFormValues)
	setUserInput(true);
    }

    const fetchCVEInfo = async () => {
	let cveAPI = new CVEAPI();
        await cveAPI.getCVE(vulCVE).then((response) => {
            setCveInfo(response);
            console.log(response);
        }).catch(err => {
            console.log(err);
            if (err.response.status == 400) {
                setError(`Error retrieving CVE: ${err.response.data.error}: ${err.response.data.message}`)
            } else if (err.response.status == 404) {
		setError(`Error retrieving CVE: ${err.response.data.message}`);
            }

        });

    }


    useEffect(() => {
        if (cveInfo) {
            /* parse data */
            try {
                setDatePublic(cveInfo.cveMetadata.datePublished);
                setVulDescription(cveInfo.containers.cna.descriptions[0].value);
                setTitle(cveInfo.containers.cna.title);
                if ('metrics' in cveInfo.containers.cna) {
                    setMetrics(cveInfo.containers.cna.metrics);
                } else {
                    setMetrics([]);
                }
                if ('credits' in cveInfo.containers.cna) {
                    let a = cveInfo.containers.cna.credits.map(item => item.value);
                    setAcks(a)
                }
                if ('problemTypes' in cveInfo.containers.cna) {
                    let pt = cveInfo.containers.cna.problemTypes.map(item => item.descriptions[0].description)
                    setCWESelected(pt);
                }
                if ('references' in cveInfo.containers.cna) {
                    let ref = cveInfo.containers.cna.references.map(item => {
			if (Object.keys(item).includes('tags')) {
                            return {url: item.url, summary: "", tags: item.tags}
                        } else {
                            return {url: item.url, summary: ""}
                        }
		    });
                    setReferences(ref);
                }
            } catch (err){
                console.log(err);
            }
        }

    }, [cveInfo])


    const addReference = () => {
        setReferences([...references, {url: "", summary: ""}]);
    }


    const addCvssReference = () => {
	props.vul.cvss.forEach(x => {
	    if (x.version == "4.0" && x.vectorString) {
		setReferences([...references, {url: `https://www.first.org/cvss/calculator/4.0#${x.vectorString}`, summary: "CVSS 4.0 Score (first.org)"}]);
	    }
	});
    }

    const addAck = () => {
        setAcks([...acks, {names: ''}]);
    }

    const handleIndexChange = (t, i, e) => {

        let formname = e.target.name
	if (t === "ref") {
            let newFormValues = [...references];
            newFormValues[i][formname] = e.target.value;
            setReferences(newFormValues);
	    setUserInput(true);
        } else {
            let newFormValues = [...acks];
	    newFormValues[i][formname] = e.target.value;
            setAcks(newFormValues);
	    setUserInput(true);
        }

    }


    const hasCvssV4 = () => {
	const cvss_exists = props.vul?.cvss?.some(x => x.version === "4.0");
	const ref_exists = references.some(x => x.url.includes("4.0#CVSS:4.0"));

	return cvss_exists && !ref_exists;
    }
	

    const setRefTags = (e, i) => {
	console.log(e);
	let newFormValues = [...references];
	newFormValues[i]["tags"] = e;
	setReferences(newFormValues);
	setUserInput(true);

    }


    const handleClose = () => {
	if (userInput) {
	    if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
		setUserInput(false);
		props.hideModal();
	    }
	} else {
	    props.hideModal();
	}
    };


    const popover = (

	  <Popover id="popover-basic">
	      <Popover.Body>
		  <Calendar onChange={item => (changeDate(item), setShowCalendar(false))} date={datePublic ? addDays(new Date(datePublic), 1) : new Date()} />
		  
	      </Popover.Body>
	  </Popover>
    )
    
    
    return (
        <Modal show={props.showModal} onHide={handleClose} size="xl" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom mb-0">
                <Modal.Title>{props.modalTitle ?
			      `${props.modalTitle}`
			      :
			      <>
				  {askUserToChooseVul ?
				   `Choose Vul to Edit`
				   :
				   <>
				       {props.vul ?
					`Edit Vulnerability ${props.vul.vul}`
					:
					`Add Vulnerability`
				       }
				   </>
				  }
			      </>
			     }
		</Modal.Title>
            </Modal.Header>
	    <Form onSubmit={(e)=>submitVul(e)}>



		<Modal.Body>

		    {breadCrumbs.length > 0 && !askUserToChooseVul &&
		     <div className="mb-2">
			 <a href="#" onClick={(e)=>(e.preventDefault(), props.editVul(breadCrumbs))}>
			     <i className="fas fa-chevron-left"></i> Choose Vul to Edit
			 </a>
		     </div>
		    }
		    


		    {Array.isArray(props.vul) && props.bulk &&
		     <div className="alert alert-warning">You are bulk editing multiple vulnerabilities:{" "}
		     {props.vul?.map((x, index)=> (<span key={`bulkedit-${index}`}>{x.original.vul}{" "}</span>))}</div>
		    }

		    {askUserToChooseVul ?
		     <VulSelection
			 vuls = {props.vul}
			 onSelect = {(e) => props.editVul(e)}
		     />

		     :
		     <>
		    	 <div className="text-end mb-0"><i className="fas fa-star"></i> Fields required to publish CVE.</div>

			 {alert &&
			  <div className="alert alert-info">{alert}</div>
			 }
			 {error &&
			  <div className="alert alert-danger">{error}</div>
			 }
			 {drfError &&
			  <DRFErrorMessage
			      error={drfError}
			  />
			 }

			 <Row>
			     <Col lg={6}>
				 {Array.isArray(props.vul) ?
				  ""
				  :
				  <Form.Group className="mb-3" controlId="cveIDInput">
				      <div className="d-flex justify-content-between">
					  <Form.Label>CVE <i className="fas fa-star"></i>
					  </Form.Label>
					  {vulCVE ?
					   <Button
					       size="sm"
					       className="mb-2"
					       onClick={(e)=>{props.syncCVE ? props.syncCVE(null, vulCVE) : fetchCVEInfo()}}
					       variant="outline-secondary">
					       Sync CVE
					   </Button>
					   :
					   <>
					       {props.reserveCVE &&
						<Button
						    size="sm"
						    className="mb-2"
						    onClick={(e)=>tryReserve()}
						    variant="outline-secondary">
						    Reserve CVE
						</Button>
					       }
					   </>
					  }

				      </div>

                                      <Form.Control name="cve" isInvalid={invalidCVE} value={vulCVE} onChange={(e)=>(setUserInput(true), setVulCVE(e.target.value))}/>
                                      {invalidCVE &&
                                       <Form.Text className="error">
					   CVE ID is required. Placeholders are accepted.
                                       </Form.Text>
                                      }
				  </Form.Group>
				 }
				 <Form.Group className="mb-3" controlId="vulnerabilityDescriptionInput">
                                     <Form.Label>Vulnerability Description<span className="required">*</span> <i className="fas fa-star"></i></Form.Label>
                                     <Form.Control name="description" as="textarea" rows={3} isInvalid={invalidDescription} value={vulDescription} onChange={(e)=>(setUserInput(true),setVulDescription(e.target.value))}/>
                                     {invalidDescription &&
                                      <Form.Text className="error">
					  Vulnerability Description is required.
                                      </Form.Text>
                                     }
				 </Form.Group>

				 <Form.Group className="mb-3" controlId="vinceTags">
                                     <Form.Label>VINCE-NT Tags</Form.Label>
				     <TagTypeahead
					 dataType = "vulnerability"
					 setTags ={(e)=> (setUserInput(true), setTags(e))}
					 tags = {tags}
					 disabled={false}
					 label={"vinceTags"}
				     />
				     {/*<Typeahead
					 id="tags"
					 multiple
					 options={[]}
					 allowNew
					 onChange={(e)=>(setUserInput(true),setTags(e))}
					 className="typeahead"
					 selected={tags}
					 placeholder="Add Tags"
					 />*/}
				 </Form.Group>
				 <Form.Group className="d-flex align-items-center gap-2 mb-3" controlId="datePublicInput">
                                     <Form.Label className="text-nowrap">Date Public <i className="fas fa-star"></i></Form.Label>
				     <Form.Control type="text" name="date_public" placeholder="YYYY-MM-DD"  isInvalid={invalidDate} value={datePublic} onChange={(e)=>changeDate(e.target.value, false)} />         
				     <OverlayTrigger trigger="click" onToggle={(e)=>setShowCalendar(e)} placement="right" overlay={popover} rootClose show={showCalendar}>
					 <Button variant="icon"><i className="fas fa-calendar" title="Choose Date Public"></i></Button>
				     </OverlayTrigger>
					 
				     {datePublic &&
				      <Button variant="icon" onClick={(e)=>changeDate("")}><i className="fas fa-trash warningtext" title="Remove vulnerability public date"></i></Button>
				     }                                                                                          

				 </Form.Group>
				 {invalidDate &&
				  <Form.Text className="error">
				      Invalid date format.  Must be YYYY-MM-DD.
				  </Form.Text>
				 }    
				     
				     
                                 {/*<Form.Control type="date" name="date_public" value={datePublic} onChange={(e)=>changeDate(e.target.value)}/>*/}

				 <Form.Group className="mb-3" controlId="publishToggle">
				     <Form.Label className="me-3">Publish </Form.Label>
				     <ButtonGroup>
					 {radios.map((radio, idx) => (
					     <ToggleButton
						 key={idx}
						 id={`radio-${idx}`}
						 type="radio"
						 size="sm"
						 variant={idx ? 'outline-danger' : 'outline-success'}
						 name="publish"					    
						 value={radio.value}
						 checked={publish === radio.value}
						 onChange={(e) => (setUserInput(true), setPublish(e.currentTarget.value))}
					     >
						 {radio.name}
					     </ToggleButton>
					 ))}
				     </ButtonGroup>
				 </Form.Group>
			     </Col>
			     <Col lg={6}>
				 <Form.Group className="mb-3" controlId="vulnerabilityTitleInput">
                                     <Form.Label>Vulnerability Title</Form.Label>
                                     <Form.Control name="title" as="textarea" rows={3} value={title} onChange={(e)=>(setUserInput(true),setTitle(e.target.value))}/>
				 </Form.Group>

				 <Form.Group className="mb-3" controlId="problemTypesInput">
				     <Form.Label>Problem Types (CWE) <i className="fas fa-star"></i></Form.Label>

				     <AsyncTypeahead
					 id="cwe"
					 multiple
					 name="cwe"
					 paginate
					 onSearch={handleCWESearch}
					 isLoading={isCwesLoading}
					 labelKey="cwe"
					 options={cwes}
					 className="typeahead"
					 onChange={(e)=>(setUserInput(true), setCWESelected(e))}
					 selected={cweSelected}
					 placeholder="Add problem type(s)..."
					 renderMenuItemChildren={(option) => (
					     <div className="d-flex align-items-center gap-2">
						 <span className="fw-500">{option.cwe}</span>
						 <Badge pill bg={getUsageColor(option.usage)}>{option.usage}</Badge>
						 {option.children.length > 0 &&
						  <Badge bg="primary">Has Children</Badge>
						 }
						 {option.slice &&
						  <Badge bg="secondary">NVD</Badge>
						 }
					     </div>
					 )}

				     />
				 </Form.Group>
				 <Form.Group className="mb-3" controlId="cveTagsInput">
                                     <Form.Label>CVE CNA Tags</Form.Label>
                                     <Typeahead
					 id="cve_tags"
					 multiple
					 options={CVETAGS_ENUM}
					 onChange={setCveTags}
					 className="typeahead"
					 selected={cveTags}
					 placeholder="Add CNA Tags"
                                     />
				 </Form.Group>

				 <div className="mb-3">
				     <Form.Label>References <i className="fas fa-star"></i></Form.Label>
				     {references.map((element, index) => (
					 <div key={`ref-${index}`} className="border-bottom py-2 mb-2">
                                             <Row>
						 <Col lg={7} sm={11} md={7}>
						     <Form.Group controlId="referenceUrlInput">
							 <Form.Label>URL</Form.Label>
							 <Form.Control name="url" value={element.url} onChange={(e)=>handleIndexChange("ref", index, e)} aria-label="Reference URL" />
							 </Form.Group>
						 </Col>
						 <Col lg={4} sm={11} md={4}>
						     <Form.Group controlId="referenceSummaryInput">
							 <Form.Label>Summary</Form.Label>
							 <Form.Control name="summary" value={element.summary} onChange={(e)=>handleIndexChange("ref", index, e)} aria-label="Reference Summary" />
						     </Form.Group>
						 </Col>
						 <Col lg={1} sm={1} md={1} id="refRemoveBtn" className="px-0">
                                                     <Button variant="btn btn-icon" onClick={() => removeRef(index)}><i className="fas fa-trash" title="Remove reference"></i></Button>
						 </Col>
                                             </Row>
					     <Row>
						 <Col lg={12}>
						     <Form.Group controlId="referenceTagInput">
							 <Form.Label>Tags</Form.Label>
							 <Typeahead
							     id="ref_tags"
							     multiple
							     options={REFTAGS_ENUM}
							     onChange={(e)=>setRefTags(e, index)}
							     selected={element.tags || []}
							     placeholder="Tag Reference"
							 />
						     </Form.Group>
						 </Col>
					     </Row>
					 </div>
				     ))}
				     <div className="d-flex align-items-start gap-2">
					 <Button size="sm" variant="outline-primary" onClick={()=>addReference()}><i className="fas fa-plus" title="Add additional reference"></i> Add Reference</Button>
					 {hasCvssV4() &&
					  <Button size="sm" variant="outline-primary" onClick={()=>addCvssReference()}><i className="fas fa-plus" title="Add CVSS reference to first.org"></i> Add CVSS Reference</Button>
					 }
				     </div>
				 </div>
			     </Col>
			 </Row>
			 <hr/>
			 <Row className="border-bottom py-2 mb-2">
			     <Col lg={12}>
				 <Form.Label>Acknowledgments/Credits</Form.Label>
				 {acks.map((element, index) => (
				     <div key={`documentAck-${index}`} className="py-2 mb-2">
					 <Row>
					     <Col lg={6} sm={11} md={11}>
						 <Form.Group controlId="ackNameInput">
						     <div className="d-flex align-items-center gap-2">
							 
							 <Form.Label>Name</Form.Label>
							 <Form.Text className="mb-2 pb-0 mt-0">Comma separate multiple names from same org</Form.Text>
							 
						     </div>
						     <Form.Control name="names" value={element.names} onChange={(e)=>handleIndexChange("ack_name", index, e)} aria-label="Acknowledgment Name(s)" />
						 </Form.Group>
					     </Col>
				             <Col lg={5} sm={11} md={11}>
						 <Form.Group controlId="organizationInput">
						     <Form.Label>Organization</Form.Label>
						     <Form.Control name="organization" value={element.organization || ""} onChange={(e)=>handleIndexChange("ack_org", index, e)} aria-label="Acknowledgment Organization" />
						 </Form.Group>
					     </Col>
					     <Col lg={1} sm={1} md={1}>
						 <Form.Label>{" "}</Form.Label>
						 <Button variant="btn btn-icon" className="mt-4" onClick={() => removeAck(index)}><i className="fas fa-trash" title="remove acknowledgment"></i></Button>
					     </Col>
					 </Row>
				     </div>
				 ))}
				 <Button size="sm" variant="outline-primary" className="mb-2" onClick={()=>addAck()}><i className="fas fa-plus" title="Add acknowledgment"></i> Add Acknowledgment</Button>
			     </Col>
			 </Row>
			 <Row>
			     <Col lg={12}>
				 <VulAttributeEditor
				     vul={props.vul}
				     setAttributes = {setAttributes}
				 />
			     </Col>
			 </Row>
		     </>
		    }
		     </Modal.Body>
		<Modal.Footer>
			 <Button variant="outline-secondary" title="cancel save" data-testid="cancel-editvul" type="cancel" onClick={(e)=>(e.preventDefault(),handleClose())}>Cancel</Button>
		    {askUserToChooseVul ?
		     ""
		     :
		     <Button type="submit" variant="primary" title="save vulnerability"><i className="fas fa-plus"></i> Save Vulnerability </Button>
		    }
		</Modal.Footer>
	    </Form>

	</Modal>

    )
}

export default EditVulModal;
