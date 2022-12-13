import React from 'react'
import { useState, useEffect, useRef} from 'react';
import axios from 'axios';
import { Modal, Badge, Tabs, Tab, Alert, Form, Button } from "react-bootstrap";
import CVEAPI from './CVEAPI';
import {format, formatDistance} from 'date-fns';
import ThreadAPI from './ThreadAPI';
import ComponentAPI from './ComponentAPI';
import CVSSSeverityBadge from 'Components/CVSSSeverityBadge';
import { CVSS40 } from '@pandatix/js-cvss';


const componentapi = new ComponentAPI();

const threadapi = new ThreadAPI();

const PopulateCVEModal = ({ showModal, hideModal, cveAccount, vul, caseInfo, edit, updateVuls }) => {

    const [apiError, setApiError] = useState(null);
    const [cveInfo, setCveInfo] = useState(null);
    const [description, setDescription] = useState(null);
    const [problemTypes, setProblemTypes] = useState([]);
    const [affected, setAffected] = useState([]);
    const [references, setReferences] = useState([]);
    const [datePublic, setDatePublic] = useState("");
    const [datePublished, setDatePublished] = useState("");
    const [metrics, setMetrics] = useState([]);
    const [ssvc, setSSVC] = useState(null);
    const [syncSSVC, setSyncSSVC] = useState(true); /* true checked, false not checked */
    const [title, setTitle] = useState("");
    const [credits, setCredits] = useState([]);
    const formRef = useRef(null);


    const addStatus = async (vul) => {
	let axiosArray = [];

	affected.map(item => {
	    let data = {'vuls': [vul],
			'component': {'name': item.product, 'supplier': item.vendor},
		       }
	    let status = [];
	    if (item.versions) {
		item.versions.map(v => {
		    let ver = {};
		    ver['status'] = v.status;
		    if (v.version.includes("<=")) {
			ver['version_range'] = "<=";
			var arr = v.version.split("<=").map(function(item) {
			    return item.trim();
			});
			console.log(arr);
			if (arr.length > 1) {
			    ver['version_value'] = arr[0] ? arr[0] : '0';
			    ver['version_end_range'] = arr[1];
			} else {
			    ver['version_value'] = '0';
			    ver['version_end_range'] = arr[0];
			}

		    } else if (v.version.includes("<")) {
			ver['version_range'] = "<";
			var arr = v.version.split("<").map(function(item) {
			    return item.trim();
			});
			if (arr.length > 1) {
			    ver['version_value'] = arr[0] ? arr[0] : '0';
			    ver['version_end_range'] = arr[1];
			} else {
			    ver['version_value'] = '0';
			    ver['version_end_range'] = arr[0];
			}
		    } else {
			ver['version_value'] = v.version;
		    }
		    status.push(ver)
		});
		data['status'] = status;
		axiosArray.push(componentapi.addStatus(caseInfo, data));
	    } else {
		let data = {'vuls': [vul],
                            'component': {'name': item.product, 'supplier': item.vendor},
                            'status': item.defaultStatus,
                            'version': item.packageName ? item.packageName: "default"}
		axiosArray.push(componentapi.addStatus(caseInfo, data));
	    }
	});

	await axios.all(axiosArray).then((response) => {
	    updateVuls();
	    hideModal();
	}).catch(err => {
	    updateVuls();
	    hideModal(`Vulnerability successfully imported but could not add component and status: ${err.response.data.detail}`);
	});
    }

    const testSubmit = async (conf) => {

	const formData = {'description': description,
			  'cve': vul,
			  'problem_types': problemTypes,
			  'references': references,
			  'title': title,
			  'date_published': new Date(datePublished),
			  'date_public': format(new Date(datePublic), 'yyyy-MM-dd')}

	let ssvcFormData = {};
	if (metrics.length > 0) {
	    formData['cvss'] = [];
	    metrics.map((cvss, index) => (
                Object.keys(cvss).map(key => {
                    if (key.startsWith("cvss")) {
			let c = {vectorString: cvss[key]?.vectorString,
				 version: cvss[key]?.version,
				 score: cvss[key]?.baseScore,
				 severity: cvss[key]?.baseSeverity,
				 metrics_json: cvss};
			formData['cvss'].push(c);
		    }
		})))
	}

	if (syncSSVC && ssvc) {
	    let attrs = [];
	    ssvc.options.forEach(x => {
		attrs.push({'label': Object.keys(x)[0], 'value': Object.values(x)[0]});
	    });
	    ssvcFormData['tree_type'] = `${ssvc.role} ${ssvc.version}`;
	    ssvcFormData['final_decision'] = 'Uncalculated';
	    ssvcFormData['vector'] = 'Uncalculated';
	    ssvcFormData['decision_tree'] = attrs;
	    if (edit) {
		if (vul?.ssvc_decision_tree?.length > 0) {
		    threadapi.updateSSVCDecision(edit, ssvcFormData).then((response) => {
		    }).catch(err => {
			console.log(err);
		    });
		} else {
		    threadapi.addSSVCDecision(edit, ssvcFormData).then((response) => {
		    }).catch(err => {
			console.log(err);
		    });
		}
	    }						     
		   
	}

	if (edit) {
	    threadapi.updateVul(edit, formData).then((response) => {
		if (affected) {
		    addStatus(response.data.id);
		} else {
		    updateVuls();
		    hideModal();
		}
	    }).catch(err => {
		setApiError({variant: 'danger', msg: `Error updating vulnerability information: ${err.message}`});
		formRef.current?.scrollIntoView();

	    });

	} else {
	    await threadapi.addVul(caseInfo, formData).then((response) => {
		if (syncSSVC && ssvc) {
		    threadapi.addSSVCDecision({'id':response.data.id}, ssvcFormData).then((response) => {
		    }).catch(err => {
			console.log(err);
		    });
		}
		if (affected) {
		    addStatus(response.data.id);
		    
                } else {
		    updateVuls();
		    hideModal();
		}
	    }).catch(err => {
		setApiError({variant: 'danger', msg: `Error adding new vulnerability: ${err.message}: ${err.response.data.detail}`});
		formRef.current?.scrollIntoView();
		console.log(err);
	    });
	}
    }


    const fetchCVEInfo = async () => {

	let cveAPI = new CVEAPI();
	if (cveAccount) {
	    cveAPI = new CVEAPI(cveAccount.org_name, cveAccount.email, cveAccount.api_key, cveAccount.server);
	}
        await cveAPI.getCVE(vul).then((response) => {
	    setCveInfo(response);
	    console.log(response);
	}).catch(err => {
            console.log(err);
	    if (err.response.status == 400) {
		setApiError({variant: 'danger', msg:`Error retrieving CVE: ${err.response.data.error}: ${err.response.data.message}`})
	    } else if (err.response.status == 404) {
		setApiError({variant: 'danger', msg: `Error retrieving CVE: ${err.response.data.message}`});
	    }

        });

    }

    const getMetrics = (adp) => {
	for (let i = 0; i < adp.length; i++) {
            let _adp = adp[i];
            if (_adp.providerMetadata.shortName == "CISA-ADP" && "metrics" in _adp) {
                /* this is our adp container */
		if (_adp.metrics.length > 0) {
		    if ("other" in _adp.metrics[0]) {
			setSSVC(_adp.metrics[0].other.content);
			console.log(_adp.metrics[0].other.content);
		    }
		}
                break;
            }
        }
    }


    useEffect(() => {
	if (cveInfo) {
	    /* parse data */
	    try {
		setDatePublic(cveInfo.cveMetadata.datePublished);
		if (cveInfo.cveMetadata.dateUpdated) {
		    setDatePublished(cveInfo.cveMetadata.dateUpdated);
		} else {
		    setDatePublished(cveInfo.cveMetadata.datePublished);
		}
		setDescription(cveInfo.containers.cna.descriptions[0].value);
		setAffected(cveInfo.containers.cna.affected);
		setTitle(cveInfo.containers.cna.title);
		if ('metrics' in cveInfo.containers.cna) {
		    setMetrics(cveInfo.containers.cna.metrics);
		} else {
		    setMetrics([]);
		}
		if ('credits' in cveInfo.containers.cna) {
                    setCredits(cveInfo.containers.cna.credits)
                } else {
                    setCredits([]);
                }
		if ('problemTypes' in cveInfo.containers.cna) {
		    let pt = cveInfo.containers.cna.problemTypes.map(item => {
			console.log(item);
			if (item.descriptions[0]?.cweId) {
			    return item.descriptions[0]?.cweId;
			} else {
			    return item.descriptions[0]?.description;
			}
		    });
		    setProblemTypes(pt);
		}
		if ('references' in cveInfo.containers.cna) {
		    let ref = cveInfo.containers.cna.references.map(item => {
			if (Object.keys(item).includes('tags')) {
			    return {url: item.url, summary: "", tags: item.tags}
			} else {
			    return {url: item.url, summary: ""}
			}
		    })
		    setReferences(ref);
		}

		if ('adp' in cveInfo.containers) {
		    getMetrics(cveInfo.containers.adp);
		}

	    } catch (err){
		console.log(err);
	    }
	}

    }, [cveInfo])

    useEffect(() => {
	if (showModal && vul) {
	    setCveInfo(null);
	    setSSVC(null);
	    setSyncSSVC(true);
	    setApiError(null);
	    fetchCVEInfo()
	}

    }, [showModal, cveAccount, vul]);


    return (
	<Modal show={showModal} onHide={hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton>
		<Modal.Title>Confirm CVE Additions</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		<div id="testref" ref={formRef}>&nbsp; </div>
		{apiError &&
		 <Alert variant={apiError.variant}>{apiError.msg}</Alert>
		}

		{cveInfo &&
		 <Tabs
                     defaultActiveKey='addData'
                     className="mb-3"
                     fill
                 >
		     <Tab eventKey='addData' title='Confirm Additions'>
			 <p className="lead">{cveInfo.cveMetadata.cveId} was <b>{cveInfo.cveMetadata.state}</b> by <b>{cveInfo.cveMetadata.assignerShortName}</b>
			     {cveInfo.cveMetadata.datePublished &&
			<span> on {format(new Date(cveInfo.cveMetadata.datePublished), 'yyyy-MM-dd')}</span>}
			     {cveInfo.cveMetadata.dateUpdated &&
			      <span> and last updated on {format(new Date(cveInfo.cveMetadata.dateUpdated), 'yyyy-MM-dd')}
			      </span>
			     }
			 </p>
			 <Alert variant="warning">Confirm adding the following information to your case. <b>This may overwrite any information you have already added to this vulnerability</b>:</Alert>
			 {title &&
			  <div className="mb-3"><b>Title:</b> {title} </div>
			 }
			 <div className="mb-3"><b>Description:</b><br/>
			     {description}
			 </div>
			 {datePublic &&
			  <div className="mb-3"><b>Date Public:</b> {format(new Date(datePublic), 'yyyy-MM-dd')}</div>
			 }
			 <div><b>Problem Types:</b>
			     <ul className="list-unstyled">
				 {problemTypes.map((t, index) => {
				     return (
					 <li key={`pt-${index}`}>{t}</li>
				     )
				 })}
			     </ul>
			 </div>
			 {metrics?.length > 0 &&
			  <div>
			      {metrics.map((cvss, index) => (
				  Object.keys(cvss).map(key => {
				      if (key.startsWith("cvss")) {
					  return (
					      <div key={`metrics-${key}`} className="mb-3">
						  <b>CVSS Version {cvss[key]?.version || "3.x"}:</b>
						  <div><b>Vector:</b> {cvss[key]?.vectorString}</div>
						  <div><b>Base Score</b>: {cvss[key]?.baseScore}</div>
						  {cvss[key]?.baseSeverity &&
						   <div><b>Severity</b>: <CVSSSeverityBadge
									     severity = {cvss[key]?.baseSeverity}
									 />

						   </div>
						  }
					      </div>
					  )
				      }
				  })
			      ))}
			  </div>
			 }
			 <div  className="mb-3"><b>References:</b>
			     <ul className="list-unstyled">
                                 {references.map((t, index) => {
                                     return (
                                         <li key={`ref-${index}`}>{t.url} {t.tags?.map((tag, idx) => (<Badge bg="primary" className="mx-1" key={`reftag-${index}-${idx}`}>{tag}</Badge>))}</li>
                                     )
                                 })}
                             </ul>
                         </div>
			 {credits?.length > 0 &&
			  <div><b>Credits:</b>
			      <ul className="list-unstyled">
				  {credits.map((t, index) => {
				      return (
					  <li key={`credit-${index}`}>
					      {t.value} {t.type && `(${t.type})`}
					  </li>
				      )
				  })}
			      </ul>
			  </div>
			 }
			 <div className="mb-3"><b>Affected Products:</b>
			     <table className="table">
				 <thead>
				     <tr>
					 <th>Product</th>
					 <th>Vendor</th>
					 <th>Version</th>
					 <th>Status</th>
				     </tr>
				 </thead>
				 <tbody>

                                     {affected.map((t, index) => {
					 return (
					     t.versions ?
					     <React.Fragment key={`affected-${index}`}>
						 {t.versions.map((v, ind) => {
						     return (
							 <tr key={`affectedprod-${index}-${ind}`}>
							     <td>{t.product}</td>
							     <td>{t.vendor}</td>
							     <td>{v.version}</td>
							     <td>{v.status}</td>
							 </tr>
						     )
						 })}
					     </React.Fragment>
					     :
					     <React.Fragment key={`affected=${index}`}>
                                                 <tr>
                                                     <td>{t.product}</td>
                                                     <td>{t.vendor}</td>
                                                     <td></td>
                                                     <td>{t.defaultStatus}</td>
                                                 </tr>
                                             </React.Fragment>
					 )
				     })}
				 </tbody>
			     </table>

                         </div>

			 {ssvc &&

			  <div className="mb-3">
			      <div className="d-flex align-items-start gap-2 ">
			      <b>SSVC (from ADP container):</b>
			      <Form.Check
				  type="checkbox"
				  id="include_ssvc"
				  label={`Sync SSVC?`}
				  checked={syncSSVC}
				  onChange={(e) => setSyncSSVC(e.target.value)}
			      />
				  </div>
                             <table className="table">
                                 <thead>
                                     <tr>
                                         <th>Decision Point</th>
                                         <th>Value</th>
				     </tr>
				 </thead>
				 <tbody>
				     {ssvc.options.map((x, idx) => (
					 <tr key={`ssvc-${idx}`}>
					     <td>{Object.keys(x)[0]}</td>
					     <td>{Object.values(x)[0]}</td>
					 </tr>
				     ))}
				 </tbody>
			     </table>
			  </div>
			 }
					 
					 

		     </Tab>
		     <Tab eventKey="json" title="Full JSON record">
			 <pre>
			     {JSON.stringify(cveInfo, null, 2)}
			 </pre>
		     </Tab>
		 </Tabs>
		}


	    </Modal.Body>
            <Modal.Footer>
		<Button variant="secondary" onClick={hideModal}>
		    Cancel
		</Button>
		{cveInfo && cveInfo.cveMetadata.state == "PUBLISHED" &&
		 <Button variant="primary" onClick={() => testSubmit(0)}>
		     Submit
		 </Button>
		}
            </Modal.Footer>
	</Modal>
    )
}

export default PopulateCVEModal;
