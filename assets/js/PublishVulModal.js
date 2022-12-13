import React from 'react';
import { Alert, Toast, Tab, Nav, Modal, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import {Typeahead} from 'react-bootstrap-typeahead';
import { useState, useEffect } from 'react';
import CVEAPI from './CVEAPI';
import CVEPreviewApp from './CVEPreviewApp';
import AdminAPI from './AdminAPI';
import CaseThreadAPI from './ThreadAPI';
import VulApprovalApp from "./VulApprovalApp";
import '../css/casethread.css';
import PublishCVEApp from './PublishCVEApp';
import DRFErrorMessage from "./DRFErrorMessage";
import { CVSS40 } from '@pandatix/js-cvss';


let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const SSVC_ROLE = appConfig.ssvc_role || 'TEST ROLE';
const ADP_CONTAINER_TITLE = appConfig.adp_container_title || "ADP Container";

const adminapi = new AdminAPI();
const threadapi = new CaseThreadAPI();
const cveapi = new CVEAPI();

const PublishVulModal = (props) => {

    const [activeTab, setActiveTab] = useState("publish");
    const [error, setError] = useState("");
    const [notCNA, setNotCNA] = useState(false);
    const [publishWarning, setPublishWarning] = useState(null);
    const [cvePublishError, setCvePublishError] = useState(null);
    const [drfError, setDRFError] = useState(null);
    const [vulJSON, setVulJSON] = useState("");
    const [vul, setVul] = useState("")
    const [cveAccount, setCveAccount] = useState("");
    const [accounts, setAccounts] = useState([]);
    const [btnDisabled, setBtnDisabled] = useState(true);
    const [successMsg, setSuccessMsg] = useState(null);
    const [adpRole, setAdpRole] = useState(false);
    const [adpContainer, setAdpContainer] = useState(null);
    const [adpError, setAdpError] = useState(null);
    const [orgAdp, setOrgAdp] = useState(null);
    const [ssvcExists, setSSVCExists] = useState(false);
    const [question, setQuestion] = useState(true);
    const [previouslyPublished, setPreviouslyPublished] = useState(null);
    const [infoMissing, setInfoMissing] = useState(false);
    const [approvedToPublish, setApprovedToPublish] = useState(false);

    const [showToast, setShowToast] = useState({
        show: false,
        msg: "",
        type: "",
        bg: "success"
    });

    useEffect(() => {
	if (activeTab == "publish" && (notCNA || infoMissing || !approvedToPublish)) {
	    setBtnDisabled(true);
	} else if (activeTab == "adp") {
	    setBtnDisabled(true);
	} else {
	    setBtnDisabled(false);
	}
    }, [activeTab, notCNA, infoMissing, approvedToPublish]);


    useEffect(() => {
	/* check for SSVC info */
	if (adpContainer) {
	    try {
		for (let i=0; i < adpContainer.length; i++) {
		    let adp = adpContainer[i];
		    if (adp.providerMetadata.shortName == cveAccount.org_name) {
			/* this is our adp container */
			setOrgAdp(adp);
			if ("metrics" in adp) {
			    for (let k=0; k < adp.metrics.length; k++) {
				if ("other" in adp.metrics[k]) {
				    if (adp.metrics[k].other.type == "ssvc") {
				    setSSVCExists(true);
					break;
				    }
				}
			    }
			}
			break;
		    } else {
			continue;
		    }
		}
	    } catch (err) {
		console.log(err);
	    }
	}
    }, [adpContainer]);


    useEffect(() => {

	if (cveAccount) {

	    /* all these need to be reset*/
	    //setBtnDisabled(false);
	    setCvePublishError(null);
	    setAdpError(null);
	    setPublishWarning(null);
	    setAdpRole(false);

	    /* check for ADP Role */
	    let api = new CVEAPI(cveAccount.org_name, cveAccount.email, cveAccount.api_key, cveAccount.server);

	    const fetchCVERole = async () => {
		await api.getORG().then((response) => {
		    let data = response.data;
		    if (data.authority && data.authority.active_roles.includes('ADP')) {
			setAdpRole(true);
		    }
		});
	    };

	    fetchCVERole();

	    if (vul) {
		updateVulJSON();
	    }
	    /* this is going to pull CVE information from the CVE environment that was chosen */
	    /* if the CVE exists and this account isn't the CNA for this CVE, it's not going to allow
	       the account to publish CNA data.  Depending on the role for this account, it's possible
	       that the user will be able to publish to ADP */
	    fetchCVEMeta();
	    
	    

	}
    }, [cveAccount]);



    const fetchCVEMeta = async() => {
	let cveAPI = new CVEAPI(cveAccount.org_name, cveAccount.email, cveAccount.api_key, cveAccount.server);
	await cveAPI.getCVEMeta(vul.vul).then((response) => {
	    console.log(response);
	    let isCNA = true;
	    try {
		if (response.owning_cna != cveAccount.org_name) {
		    setPublishWarning("You are not the CNA for this CVE and cannot publish CVE data to this API environment. The following record already exists.")
		    setNotCNA(true);
		    isCNA = false;
		    /* it doesn't matter if info is missing - this user can't publish this CVE anyway */
		    setInfoMissing(false);
		    setBtnDisabled(true);
		}
		fetchADPContainer(isCNA);
	    } catch (err) {
		console.log("not able to retrieve metadata for CVE");
	    }
	}).catch(err => {
	    if (err.response && err.response.status == 404) {
		setAdpError("CVE ADP container does not exist.  Did you publish it yet?");
	    } else {
		setAdpError(err.message);
	    }
	});
    }
    

    const fetchADPContainer = async (isCNA) => {
	let cveAPI = new CVEAPI(cveAccount.org_name, cveAccount.email, cveAccount.api_key, cveAccount.server);

        await cveAPI.getCVE(vul.vul).then((response) => {
	    console.log(response);
	    try {
		if (!isCNA) {
		    setVulJSON(response)
		} else {
		    setPublishWarning(`This CVE was first published on ${response.cveMetadata.datePublished} and last updated on ${response.cveMetadata.dateUpdated}. Confirm changes before hitting publish.`);
		    setPreviouslyPublished(response);
		}
		if (response.containers.adp){
		    setAdpContainer(response.containers.adp);
		}
	    } catch (err) {
		console.log(err);
		console.log("no cve, no adp");
	    }
	}).catch(err => {
	    if (err.response && err.response.status == 404) {
		setAdpError("CVE ADP container does not exist.  Did you publish it yet?");
	    } else {
		setAdpError(err.message);
	    }
	    console.log(err);
	});
    }

    const updateSSVC = (e) => {
	let cveAPI = new CVEAPI(cveAccount.org_name, cveAccount.email, cveAccount.api_key, cveAccount.server);

	let new_array = {};
	vul.ssvc_decision_tree.forEach(item => {
	    new_array[item.label] = item.value
	})
	console.log(new_array);

	let new_content = {
	    "timestamp": new_array['date_scored'],
	    "id": vul.vul,
	    "options": [
		{
		    "Exploitation": new_array['Exploitation']
		},
		{
		    "Automatable": new_array["Automatable"]
		},
		{
		    "Technical Impact": new_array["Technical Impact"]
		}
	    ],
	    "role": SSVC_ROLE,
	    "version": "2.0.3"
	    //"generator": "AdVISE"
	}
	console.log(new_content);
	setQuestion(false);

	if (orgAdp && ssvcExists) {
	    /* we need to update the ssvc */
	    let adpUpdate = orgAdp;
            for (let k=0; k < adpUpdate.metrics.length; k++) {
                if ("other" in adpUpdate.metrics[k]) {
                    if (adpUpdate.metrics[k].other.type == "ssvc") {
			adpUpdate.metrics[k].other.content = new_content;
                    }
                }
            }
	    setBtnDisabled(false);
	    adpUpdate["title"] = ADP_CONTAINER_TITLE;
	    adpUpdate = {"adpContainer": adpUpdate}
	    setAdpContainer(adpUpdate);

	} else if (orgAdp) {
	    /* we need to add the ssvc container */
	    let adpUpdate = orgAdp;
	    if ("metrics" in adpUpdate) {
		adpUpdate.metrics.push({"other": {"type": "ssvc", "content": new_content}})
	    } else {
		adpUpdate['metrics'] = [{"other": {"type": "ssvc", "content": new_content}}]
	    }
	    adpUpdate["title"] = ADP_CONTAINER_TITLE;
	    adpUpdate = {"adpContainer": adpUpdate}
	    setAdpContainer(adpUpdate);
	    setBtnDisabled(false);
	} else {
	    /* we need to add the entire adp container */
	    let adp = {"adpContainer": {"metrics": [{"other": {"type": "ssvc", "content": new_content}}], 'title': ADP_CONTAINER_TITLE}}
	    setAdpContainer(adp);
	    setBtnDisabled(false);
	}

    }


    const fetchCVEAccount = async () => {
        try {
            const response = await adminapi.getActiveCVEAccounts();
	    let rj = await response.data;
	    console.log(rj);
	    if (rj.length > 1) {
		setAccounts(rj);
		setBtnDisabled(true);
	    } else if (rj.length == 1) {
		setCveAccount(rj[0]);
	    } else {
		setError("No active CVE account available.  Add a CVE account before attempting to publish.");
		setBtnDisabled(true);
	    }
        } catch (err) {
            console.log(err);
            setError(err);
        }
    };

    useEffect(() => {
	if (props.showModal) {
	    fetchCVEAccount();
	    setSuccessMsg(null);
	    setQuestion(true);
	    if (props.preview) {
		setActiveTab("preview");
	    } else {
		setActiveTab("publish");
	    }
	    setCvePublishError(null);
	    setAdpError(null);
	    setPreviouslyPublished(null);
	    setPublishWarning(null);
	    setVul(props.vul);
	} else {
	    setVul(null);
	    setApprovedToPublish(false);
	    setCveAccount(null);
	}


    }, [props.showModal]);


    useEffect(() => {
	if (vul) {
	    setApprovedToPublish(vul.approved);
	}
    }, [vul]);
	

    const updateVulJSON = () => {

	let json = {};
	let cnacontainer = {};
	json['descriptions'] = [{"lang": "en", "value": vul.description}];
	json["affected"] = []

        if (!(vul.references && vul.references.length > 0 && vul.affected_products && vul.affected_products.length > 0 && vul.problem_types && vul.problem_types.length > 0 && vul.date_public)) {
	    setPublishWarning("Information is missing.  Please populate all fields before publishing");
	    setBtnDisabled(true);
	    setInfoMissing(true);
	    setVulJSON("");
	    return;
	} else {
	    setInfoMissing(false);
	    setBtnDisabled(false);
	    setPublishWarning(null);
	}

	console.log(vul.affected_products);
	vul.affected_products.forEach((v) => {
	    let versions = [];
	    v.status.forEach((stat) => {
		let vul_status = stat["status"];
		switch(vul_status) {
		case 'Not Affected':
		case 'Fixed':
		    vul_status = "unaffected";
		    break;
		case 'Affected':
		    vul_status = "affected";
		    break;
		default:
		    vul_status = "unknown";
		}
		if (stat["version_range"] == "<" && stat["version_end_range"] && stat["version_type"]) {
		    versions.push({"version": stat["version_value"],
				   "status": vul_status,
				   "lessThan": stat["version_end_range"],
				   "versionType": stat["version_type"]
				  })
		} else if (stat["version_range"] == "<=" && stat["version_end_range"] && stat["version_type"]) {
		    versions.push({"version": stat["version_value"],
				   "status": vul_status,
				   "lessThanOrEqual": stat["version_end_range"],
				   "versionType": stat["version_type"]
				  })
		} else {
		    versions.push({"version": stat["version_value"],
				   "status": vul_status})
		}
	    })
	    json["affected"].push({"vendor": v.vendor, "product": v.product,
				   "defaultStatus": v.default_status.toLowerCase(),
				   "versions": versions});

	});
	if (vul.cve_tags && vul.cve_tags.length > 0) {
	    json["tags"] = vul.cve_tags;
	}
	json["problemTypes"] = [];
	vul.problem_types.forEach((vul) => {
	    let cwetype = vul.replace(/ .*/,'');
	    let descriptions = [];
	    if (cwetype === "CWE-noinfo") {
		descriptions.push({"description": vul,
				   "lang": "en"});
	    } else {
		descriptions.push({"description": vul,
				   "lang": "en",
				   "type": "CWE",
				   "cweId": cwetype})
	    }
	    json["problemTypes"].push({"descriptions": descriptions});
	});
	if (vul.cvss.length > 0) {
	    json["metrics"] = [];
	    vul.cvss.forEach(vcvss => {
		if (Object.keys(vcvss.metrics_json).length > 0) {
		    json["metrics"].push(vcvss.metrics_json);
		} else {
		    if (vcvss.version == "4.0") {
			let vec = new CVSS40(vcvss.vectorString);
			// could use above to get all score parameters
			let score = vec.Score();
			let severity = CVSS40.Rating(score);
			json["metrics"].push({"cvssV4_0": {baseScore: parseFloat(vcvss.score), baseSeverity: severity.toUpperCase(), version: "4.0", vectorString: vcvss.vectorString}, format: "CVSS", scenarios: [{lang: "en", value: "GENERAL"}]});

		    } else if (vcvss.version == "3.1") {
			json["metrics"].push({"cvssV3_1": {baseScore: parseFloat(vcvss.score), baseSeverity: vcvss.severity, version: "3.1", vectorString: vcvss.vectorString}, format: "CVSS", scenarios: [{lang: "en", value: "GENERAL"}]});
		    }
		}
	    })
	}

	if (vul.ssvc_vector) {
            let new_array = {};
            vul.ssvc_decision_tree.forEach(item => {
		new_array[item.label] = item.value
            })

            let new_content = {
		"timestamp": new_array['date_scored'],
		"id": vul.vul,
		"options": [
                    {
			"Exploitation": new_array['Exploitation']
                    },
                    {
			"Automatable": new_array["Automatable"]
                    },
                    {
			"Technical Impact": new_array["Technical Impact"]
                    }
		],
		"role": SSVC_ROLE,
		"version": "2.0.3"
	    }

	    if ("metrics" in json) {
                json["metrics"].push({"other": {"type": "ssvc", "content": new_content}})
            } else {
                json['metrics'] = [{"other": {"type": "ssvc", "content": new_content}}]
            }
	}

	if (vul.title) {
	    json["title"] = vul.title;
	}

	json["references"] = [];
	vul.references.forEach((ref) => {
	    if (ref.tags?.length > 0) {
		json["references"].push({"name":"url", "url":ref.url, "tags": ref.tags});
	    } else {
		json["references"].push({"name":"url", "url":ref.url});
	    }
	});

	if (vul.acknowledgments && vul.acknowledgments.length > 0) {
	    json["credits"] = []
	    vul.acknowledgments.forEach((ack) => {
		/* wrap in a try block since I added org at some point */
		try {
		    if (ack.organization && ack.organization !== "") {
			json["credits"].push({"value": `${ack.names}, ${ack.organization}`, "lang": "en"});
		    } else {
			json["credits"].push({"value": ack.names, "lang": "en"});
		    }
		} catch (err) {
		    json["credits"].push({"value": ack.names, "lang": "en"});
		}
	    })
	}

	let dateObj = new Date(vul.date_public);
	json["datePublic"] = dateObj.toISOString();
	cnacontainer['cnaContainer'] = json
	console.log(json);
	setVulJSON(cnacontainer);
    }

    const pickCVEAccount = (acc) => {
	setCveAccount(acc);
	console.log("setting CVE account ", acc);
    };


    const submitPubStatusVince = async (vul) => {

	await threadapi.updateVul(vul, {'date_published': new Date(), 'cve_services': 1}).then(response => {
	    /* do nothing */
	}).catch(err => {
	    setShowToast({
		show:true,
		msg: `An error occurred updating VINCE-NT vul published time`,
		type: "cve",
		bg: "danger"
	    });
	});
    }


    const submitVul = async() => {

	let json = vulJSON;
	let cveAPI = new CVEAPI(cveAccount.org_name, cveAccount.email, cveAccount.api_key, cveAccount.server);
	if (activeTab == "publish") {
	    if (previouslyPublished) {
		cveAPI.putCVE(vul.vul, json).then(response => {
		    console.log(response);
		    setSuccessMsg(response.data.message);
		    setShowToast({
			show: true,
			msg: response.data.message,
			type: "cve",
			bg: 'success'
		    });
		    submitPubStatusVince(vul);
		    setBtnDisabled(true);
		}).catch(error => {
		    setCvePublishError(`Error: ${error.response?.data?.error}: ${error.response?.data?.message}`);
		    setShowToast({
			show: true,
			msg: `An error occurred: ${error.response?.data?.error}: {error.response?.data?.message}`,
			type: "cve",
			bg: 'danger'
		    });

		    if (error.response?.status == 400 && error.response?.data) {
			setDRFError(error.response.data);
		    }
                    setBtnDisabled(true);
		});
	    } else {
		cveAPI.publishCVE(vul.vul, json).then(response => {
		    console.log(response);
		    setSuccessMsg(response.data.message);
		    setShowToast({
			show: true,
			msg: response.data.message,
			type: "cve",
			bg: 'success'
		    });
		    setBtnDisabled(true);
		    submitPubStatusVince(vul.vul);
		}).catch(error => {
		    console.log(error);
		    setCvePublishError(`Error: ${error.response?.data?.error}: ${error.response?.data?.message}`);
                    setShowToast({
                        show: true,
                        msg: `An error occurred: ${error.response?.data?.error}: {error.response?.data?.message}`,
			type: "cve",
                        bg: 'danger'
                    });
		    
                    if (error.response?.status == 400 && error.response?.data) {
			setDRFError(error.response.data);
		    }
		    setBtnDisabled(true);
		})
	    }
	} else {
	    /* this is the ADP tab */
	    if (adpRole) {
		if (adpContainer) {
		    cveAPI.putADP(vul.vul, adpContainer).then(response => {
			console.log(response);
			setSuccessMsg(response.data.message);
			setBtnDisabled(true);
			setShowToast({
			    show: true,
			    msg: response.data.message,
			    type: "adp",
			    bg: 'success'
			});
			
		    }).catch(error => {
			console.log(error);
			setCvePublishError(`Error: ${error.response.data.error}: ${error.response.data.message}`);
			setBtnDisabled(true);
			
		        setShowToast({
                            show: true,
                            msg: `An error occurred: ${error.response?.data?.error}: {error.response?.data?.message}`,
			    type: "adp",
                            bg: 'danger'
			});	
		    });
		    console.log("DO ADP STUFF");
		}
	    } else {
		setCvePublishError(`Error: You do not have the "ADP" role set on this account.`);
	    }
	}
    }

    return (
	vul ?
        <Modal show={props.showModal} onHide={props.hideModal} size="xl" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>Publish {vul.vul}</Modal.Title>
            </Modal.Header>
		<Modal.Body>
		    {error &&
                     <div className="alert alert-danger">{error}</div>
                    }

		    <>
			{successMsg &&
			 <Alert variant="success"><p>{successMsg}</p>
			     <div className="d-flex align-items-start gap-3">
				 <a target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" href={`${cveAccount.server}/cve/${vul.vul}`}>View CVE Json</a>
				 {cveAccount.server_type === "Test" ?
				  <a target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" href={`https://test.cve.org/CVERecord?id=${vul.vul}`}>View on cve.org</a>
				  :
				  <a href={`https://www.cve.org/CVERecord?id=${vul.vul}`} className="btn btn-primary" target="_blank" rel="noopener noreferrer">View on cve.org</a>
				 }
			     </div>
			 </Alert>
			}
		    </>

		    {cvePublishError ?
		     <>
			 <Alert variant="danger"> {cvePublishError}</Alert>
			 {drfError &&
			  <DRFErrorMessage
			      error={drfError}
			  />
			 }
		     </>
		     :
		     <>
			 {accounts.length > 0 &&
			  <div className="border-bottom pb-2 mb-2">
			      {cveAccount ?
			       ""
			       :
			       <div className="alert alert-danger">There are multiple active CVE accounts to choose from. Choose one to use.</div>
			      }
                              {accounts.map((acc, index) => {
				  return (
                                      <Form.Check
					  type="radio"
					  key={`account-${acc.id}`}
					  onChange={(e)=>pickCVEAccount(acc)}
					  name="account"
					  label={`${acc.org_name}: ${acc.email}`}
                                      />
				  )
                              })
                              }
			  </div>
			 }
			 {cveAccount &&
			 <Tab.Container
			     defaultActiveKey='publish'
			     activeKey={activeTab}
			     className="mb-3"
			     onSelect={setActiveTab}
			 >
			     <Nav variant="pills" className="mb-3">
				 <Nav.Item key="publish">
				     <Nav.Link eventKey="publish">Publish CVE Record</Nav.Link>
				 </Nav.Item>
				 <Nav.Item key="preview">
				     <Nav.Link eventKey="preview">Preview CVE Record</Nav.Link>
				 </Nav.Item>
				 {adpRole &&
				 <Nav.Item key="adp">
				     <Nav.Link eventKey="adp">Publish ADP Record</Nav.Link>
				 </Nav.Item>
				 }
			     </Nav>
			     <Tab.Content id="publishrec" className="p-0">
				 <Tab.Pane eventKey="publish" key="publish">

				     {!infoMissing && !notCNA &&
				      <VulApprovalApp
					  vul={vul}
					  banner={true}
					  setVul={setVul}
					  preview={(e)=>setActiveTab("preview")}
				      />
				     }
				     
				     {publishWarning ?
				      <>
					  <Alert variant="warning">{publishWarning}</Alert>
					  {infoMissing &&
					   <>
					       <PublishCVEApp
						   vul={vul}
					       />
					   </>
					  }
					   
				      </>
					   :
					   
					   <div className="d-flex justify-content-between align-items-center mb-2">
					       <div className="m-2 fw-bold">The following JSON will be published. Double check for errors.
					       </div>
					       {vulJSON &&
						
						
						
						<div>
						    <Button variant="outline-primary" size="sm" href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(vulJSON, null, 2))}`} download={`${vul.vul}.json`}><i className="fas fa-download"></i> Download JSON</Button>
						</div>
					       }
					   </div>
					  }
				     {previouslyPublished ?
				      <Row>
					  <Col lg={6}>
					      <p><b>Current CVE Record:</b></p>
					      <pre>
						  {JSON.stringify(previouslyPublished.containers.cna, null, 2)}
                                              </pre>
					  </Col>
					  <Col lg={6}>
					      <p><b>New CVE Record:</b></p>
                                              <pre>
                                                  {JSON.stringify(vulJSON, null, 2)}
                                              </pre>
                                          </Col>
				      </Row>
				      :
				      <>
					  {vulJSON &&
					   <>
					       <pre>
						   {JSON.stringify(vulJSON, null, 2)}
					       </pre>
					   </>
					  }
				      </>
				     }

				     <div className="float-end">
                                         <Toast
                                             bg={showToast.bg}
                                             onClose={() =>
                                                 setShowToast({ show: false, type: "save" })
                                             }
                                             show={showToast.show && showToast.type == "cve"}
                                         >
                                             <Toast.Body>{showToast.msg}</Toast.Body>
                                         </Toast>
                                     </div>

				 </Tab.Pane>
				 <Tab.Pane eventKey="preview" key="preview">
				     <CVEPreviewApp
					 cveInfo={vulJSON}
					 cve={vul.vul}
				     />
				 </Tab.Pane>
				 
				 {adpRole &&
				  <Tab.Pane eventKey="adp" key="adp">
				      {adpError ?
				       <Alert variant="danger">{adpError}</Alert>
				       :
				       <>
					   {vul.ssvc_decision_tree ?
					    <>
						{question &&
						 <>
						     {ssvcExists ?
						      <Alert variant="info">Do you want to update the SSVC score in your ADP container? <Button onClick={(e)=>updateSSVC(e)}>Yes</Button></Alert>
						      :
						      <Alert variant="info">Do you want to add a SSVC score to your ADP container? <Button onClick={(e)=>updateSSVC(e)}>Yes</Button></Alert>
						     }
						 </>
						}
					    </>
					    :
					    <Alert variant="info">
						Score this vulnerability before publishing your ADP container.
					    </Alert>
					   }
					   {adpContainer ?
					    <>
						{btnDisabled ?
						 <p className="lead">Current ADP container:</p>
						 :
						 <>
						     <Alert variant="warning">Approve the following contents and hit publish.</Alert>
						     <VulApprovalApp
							 vul={vul}
							 banner={true}
						     />
						 </>
						}
						<pre>
						    {JSON.stringify(adpContainer, null, 2)}
						</pre>
					    </>
					    :
					    <b>No Current ADP Container</b>
					   }

					   <div className="float-end">
                                               <Toast
						   bg={showToast.bg}
						   onClose={() =>
                                                       setShowToast({ show: false, type: "save" })
						   }
						   show={showToast.show && showToast.type == "adp"}
                                               >
						   <Toast.Body>{showToast.msg}</Toast.Body>
                                               </Toast>
					   </div>

				       </>

				      }
				  </Tab.Pane>
				 }

			     </Tab.Content>

			 </Tab.Container>
			 }
		     </>
		    }
		</Modal.Body>
	    <Modal.Footer>
		<div className="d-flex gap-2">
		    <Button variant="outline-secondary" type="cancel" onClick={(e)=>(e.preventDefault(), props.hideModal())}>Cancel</Button>
		    <Button onClick={(e)=>submitVul()} variant="primary" disabled={btnDisabled || !approvedToPublish ? true : false}> Publish </Button>
		</div>
	    </Modal.Footer>
	</Modal>
	: <></>

    )
}

export default PublishVulModal;
