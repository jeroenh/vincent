import React, { useState, useEffect } from 'react'
import {Badge, Alert, ButtonGroup, Button, Card} from 'react-bootstrap';
import { format } from 'date-fns';
import CaseThreadAPI from './ThreadAPI';
import {useParams, useNavigate, Link, useLocation} from "react-router";
import TLPLabel from "./TLPLabel";
import AdvisoryDropdown from "./AdvisoryDropdown";
import { formatInTimeZone } from 'date-fns-tz';


const caseapi = new CaseThreadAPI();

const AdvisoryPreviewApp = () => {

    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [approval, setApproval] = useState(location.state?.approval || null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [csaf, setCSAF] = useState(null);
    const [products, setProducts] = useState([]);
    const [remDisplay, setRemDisplay] = useState([]);
    const [printPreview, setPrintPreview] = useState(false);
    
    const fetchInitialData = async() => {

        await caseapi.getCSAF(id).then((response) => {
            setCSAF(response);
	    setIsLoading(false);
        }).catch(err => {
	    if (err.response.status == 403) {
                navigate("../../err");
            } else if (err.response.status == 404) {
		setError("No advisory: Create advisory before viewing CSAF.");
	    } else {
		console.log(err);
		setError(`API Error: ${err.message}`);
	    }
	    setIsLoading(false);

        });
    }

    useEffect(() => {
        fetchInitialData();
	if (id)	{
            document.title = `VINCE-NT Case#${id} CSAF Preview`;
	}
    }, [])

    const getVulSummary = (vul) => {

	let text = vul.notes.find((note) => note.category === "summary")
	if (text) {
	    return text.text;
	}
	return ""
    }

    const getVulStatements = (vul) => {
	return vul.notes.filter((note) => note.category === "description" && note.title.includes("Vendor statement"));
    }

    const getSummary = () => {

	let text = csaf.document.notes?.find((note) => note.category === "summary")
	if (text) {
	    return text.text;
	} else {
	    return "";
	}

    }

    const showRemediations = (key) => {

	if (remDisplay.includes(key)) {
	    let newrem = remDisplay.filter(x => x !== key);
	    setRemDisplay(newrem);
	} else {
	    setRemDisplay([...remDisplay, key]);
	}
    }


    const getAffectedProducts = (vul) => {
	let status = [];

	Object.keys(vul.product_status).forEach(stat => {
	    status.push({status: stat, products: vul.product_status[stat]});
	});

	return status;
    }

    const getProduct = (selected) => {
	if (selected) {
	    if (selected.includes(":")) {
		let newprodid = selected.split(/:(.*)/s)
		return products.find(p => p.id === newprodid[1]);
	    }
	}
	return products.find(p => p.id === selected);
    }


    const hasSSVC = (vul) => {
	return vul.notes.find((note) => note.title === "SSVC");
    }
    

    const getCredit = (ack) => {
	let ret = '';
	
	if (ack.names?.length > 0) {
	    ret = ack.names.join(', ');
	    if (ack.organization) {
		ret = `${ret} from ${ack.organization}`;
	    }
	} else {
	    ret = ack.organization;
	}

	return ret;
    }
	

    const getSSVC = (vul) => {

	let score = vul.notes.find((note) => note.title === "SSVC");
	if (score) {
	    return score.text;
	} else {
	    return "";
	}
    }

    const getVectorString = (vul) => {
	let cvss = {};
	vul.scores?.forEach(x => {
	    if (Object.keys(x).includes("cvss_v3")) {
		cvss = x["cvss_v3"];
	    }
	});

	return cvss;
    }

    const getRemediation = (vul, pid) => {

	let remediations = vul.remediations?.filter(r => r.product_ids.includes(pid));
	return remediations;
    }


    useEffect(() => {
	let temp_prod = [];
	if (!csaf) {
	    return;
	}

	csaf.product_tree.branches.forEach(pt => {
	    let vendor = ""
	    let product = ""
	    let version = ""
	    let name = ""
	    let prod_id = "";
	    /*vendor | product | version/range*/
	    if (pt.category === "vendor") {
		vendor = pt.name;
		if ("branches" in pt) {
		pt.branches?.forEach(pn => {
		    if (pn.category === "product_name" || pn.category === "product_family" || pn.category === "architecture") {
			product = pn.name;
			if ("branches" in pn) {
			    pn.branches?.forEach(pv => {
				/* if product_family there's another layer here */
				if (Array.isArray(pv.branches)) {
				    pv.branches.forEach(pc => {
					version = pc.name;
					name = pc.product?.name;
					prod_id = pc.product?.product_id;
					temp_prod.push({id: prod_id, name: name, version: version, product: product, vendor: vendor});
				    });
				} else {
				    version = pv.name;
				    name = pv.product?.name;
				    prod_id = pv.product?.product_id;
				    temp_prod.push({id: prod_id, name: name, version: version, product: product, vendor: vendor});
				}

			    });
			} else if ("product" in pn) {
			    /* no version - just a product name */
			    temp_prod.push({id: pn.product.product_id, name: pn.product.name, product: product, vendor: vendor});
			}

		    }

		});
		} else {
		    /* no further info */
		    version = "";
                    name = pt.product?.name;
                    prod_id = pt.product?.product_id;
		    temp_prod.push({id: prod_id, name: name, version: version, product: product, vendor: vendor});
		}

	    }
	});

	csaf.product_tree.relationships?.forEach(pt => {
	    if ("full_product_name" in pt) {
		let prod_ref = temp_prod.find(p => p.id === pt.product_reference)
		let other_prod_ref = temp_prod.find(p => p.id == pt.relates_to_product_reference)
		temp_prod.push({id: pt.full_product_name.product_id, name: pt.full_product_name.name, product: prod_ref.product, version: prod_ref.version, vendor: prod_ref.vendor, relationship: `${pt.category} ${other_prod_ref.name}`})
	    }
	});
	
	setProducts(temp_prod);
    }, [csaf])


    function formatDate(dateString, formatString = 'yyyy-MM-dd') {
	try {
	    const parsedDate = format(new Date(dateString), formatString);
	    return parsedDate;
	} catch (err) {
	    return 'Invalid Date';
	}
    }

    function printAdvisory(e) {
	e.preventDefault();
	setPrintPreview(true);


    }

    const productsHaveRelationships = (pds) => {

	if (products.length == 0) {
	    return false;
	}
	return pds.some(x => {
	    return x.products.some(prod => {
		let p = getProduct(prod);
		if (p?.relationship) {
		    return true;
		} else {
		    return false;
		}
	    });
	});
    }
	
    
    const printable_status = (status) => {

	return status.charAt(0).toUpperCase() + status.replace("_", " ").slice(1);
    }
    

    useEffect(() => {

	if (printPreview) {
	    const bodyElement = document.getElementsByTagName('body')[0];
	    //const bodyElement = document.getElementById('advisorypreview');
	    bodyElement.classList.add('printing');
	    window.print();
	    bodyElement.classList.remove('printing');
	    setPrintPreview(false);
	}

    }, [printPreview]);
    
    
    return (

	isLoading ?
	    <div className="text-center">
                <div className="lds-spinner"><div></div><div></div><div></div></div>
            </div>

	    :
	    <>
		<AdvisoryDropdown
		    caseInfo={caseInfo}
		    csaf={csaf}
		    approval={approval}
		    page="CSAF Preview"
		    update={fetchInitialData}
		/>

		{error &&
		 <Alert variant="danger">{error}</Alert>
		}


		{csaf?.document &&
		 <Card id="advisorypreview">
		     <Card.Header as="h5" className="border-bottom mb-2 d-flex justify-content-between align-items-center">
			 <Card.Title className="mb-0">{csaf.document.tracking.id}: {csaf.document.title} {csaf.document.distribution?.tlp && <TLPLabel tlp={csaf.document.distribution.tlp.label} />}</Card.Title>
			 <div id="custom-print-button">
			     <span id="print-button">
				 <a onClick={(e)=>printAdvisory(e)} href="#"><i className="fas fa-print" title="Print advisory"></i></a>
			     </span>
			 </div>
		     </Card.Header>
		     <Card.Body>
			 <p className="lead fw-bold">Release Date: {formatDate(csaf.document.tracking.initial_release_date, 'yyyy-MM-dd')}
			 <br/>Document Status: {csaf.document.tracking.status}</p>
			 {csaf.document.tracking.current_release_date !== csaf.document.tracking.initial_release_date &&
			  <p>Last Revised: { formatDate(csaf.document.tracking.current_release_date, 'yyyy-MM-dd')}</p>
			 }

			 {getSummary() &&
			  <>
			      <Card.Title>Summary</Card.Title>
			      <p>{getSummary()}</p>
			  </>
			 }

			 <Card.Title>Vulnerabilities</Card.Title>


	     {csaf.vulnerabilities?.length > 0 &&
	      <>
		  {csaf.vulnerabilities.map((vul, index) => {
		      let summary = getVulSummary(vul);
		      let products = getAffectedProducts(vul);
		      let statements = getVulStatements(vul);
		      return (
			  <div key={`vul-${index}`} className="mb-3 csaf_vul_section px-3">
			      <p className="lead"><a href={`https://www.cve.org/CVERecord?id=${vul.cve}`} target="_blank" rel="noopener">{vul.cve}</a>{vul.title && `: ${vul.title}`}</p>
			      <p>{summary}</p>
				    
			      <Card.Title>Affected Products</Card.Title>
			      <div className="table-wrapper mb-3">
			      <table className="table striped w-100">
				  <thead>
				  <tr>
				      <th>Vendor</th>
				      <th>Product</th>
				      <th>Version</th>
				      {productsHaveRelationships(products) &&
				       <th>Relationship</th>
				      }
				      <th>Status</th>
				      <th id="remediationHeader">Remediations</th>
				  </tr>
				      </thead>
				  <tbody>
				      {products.map((prod, pindex) => (

					  <React.Fragment key={`prod-${index}-${pindex}`}>
					      {prod.products.map((pid, idx) => {
						  let x = getProduct(pid);
						  let remediation = getRemediation(vul, pid);
						  if (x) {
						      return (
							  <React.Fragment key={`prod-${index}-${pindex}-${idx}`}>
							      <tr>
								  <td>{x.vendor}</td>
								  <td>{x.product}</td>
								  <td>{x.version}</td>
								  {x.relationship &&
								   <td>{x.relationship}</td>
								  }
								  <td>{printable_status(prod.status)}</td>
								  {remediation?.length > 0 ?
								   <>
								       <td className="remediationColumn">
									   <Button
									       onClick={(e)=>showRemediations(`prod-${index}-${pindex}-${idx}`)}
									       size="sm"
									       variant="primary"
									   >{remDisplay.includes(`prod-${index}-${pindex}-${idx}`) ?
									     <>Hide Remediations <i className="fas fa-caret-up"></i></>
									     :
									     <>View Remediations <i className="fas fa-caret-down"></i></>

									    }
									   </Button>
								       </td>
								   </>
								   :
								   <td></td>
								  }
							      </tr>
							      {remediation?.length > 0 &&
							       <>
								   {remediation.map((r, k) => (
								       <tr key={`remediation-${index}-${pindex}-${idx}-${k}`} className={remDisplay.includes(`prod-${index}-${pindex}-${idx}`) || printPreview ? "text-break" : "hidden"}>
									   <td colSpan="3"><Badge bg="primary" className="me-2">{r.category}</Badge>{r.details}</td>

									   <td colSpan="2"><a href={r.url} target="_blank" rel="norefererrer">{r.url}</a>
									   </td>
								       </tr>
								   ))}
							       </>
							      }
							  </React.Fragment>
						      )
						  }
					      })}

					  </React.Fragment>
				      ))}
				  </tbody>
			      </table>
			      </div>

			      {statements.length > 0 &&
			       <>
				   <Card.Title>Vendor Statement{statements.length > 1 && `s`}</Card.Title>
				   {statements.map((stmt, idx) => (
				       <p key={`vstmt-${idx}`}><b>{ stmt.title }:</b>{" "}{ stmt.text }</p>
				   ))}
			       </>
			      }

			      {vul.cwe && Object.keys(vul.cwe).length > 0 &&
			       <>
				   <Card.Title>Metrics</Card.Title>
				   <p className="lead">Problem Types: {vul.cwe?.id}: {vul.cwe?.name}</p>
			       </>
			      }

			      {hasSSVC(vul) &&
			       <>
				   {!vul.cwe &&
				    <Card.Title>Metrics</Card.Title>
				   }
				   
				   <p className="lead">{getSSVC(vul)}</p>
				   {getVectorString(vul).vectorString &&
				   <p className="lead">{getVectorString(vul).vectorString} Score: {getVectorString(vul).baseScore} <Badge bg="danger" pill>{getVectorString(vul).baseSeverity}</Badge></p>
				   }
			       </>
				   
			      }

			      {/*<div>{vul.scores?.map((score, idx) => {
				  return (
				      <React.Fragment key={`vscore-${idx}`}>
					  {Object.keys(score).map((x, i) => {
					      if (x.includes("cvss")) {
						  return (
						      <div key={`metrics-${idx}-${i}`}>
							  <p className="mb-0">CVSS version {score[x]["version"]}</p>
							  <p className="mb-0">Vector: {score[x]["vectorString"]}</p>
							  <p className="mb-0">Score: {score[x]["baseScore"]}</p>
							  {score[x]["baseSeverity"] &&
							   <p className="mb-0">Severity: {score[x]["baseSeverity"]}</p>
							  }
						      </div>
						  )
					      }
					  })}
				      </React.Fragment>
				  )})}
				  </div>*/}

			      {vul.acknowledgments?.length > 0 &&
			       <>
				   <h4>Acknowledgments</h4>
				   {vul.acknowledgments?.map((ack, index) => {
				       return(
					   <p key={`ack-${index}`}>{vul.cve} was reported by {ack.names?.join(", ")} {ack.organization ? `${ack.organization}` : ''}</p>
				       )
				   })}
			       </>
			      }

			      <Card.Title>References</Card.Title>
			      <ul className="list-unstyled">
			      {vul.references?.map((ref, index) => {
				  return(
				      <li className="mb-2" key={`ref-${index}`}><a target="_blank" rel="noreferrer" href={ref.url}>{ref.url}</a> <Badge pill bg="primary">{ref.category}</Badge></li>
				  )
			      })}
			      </ul>

			  </div>
		      )
		  })}
	      </>
	     }
		{csaf.document.acknowledgments?.length > 0 &&
		 <div className="mb-3">
		     <Card.Title>Acknowledgements</Card.Title>
		     <ul>
			 {csaf.document.acknowledgments.map((ack, index) => {
			     if (ack.summary) {
				 return (
				     <li key={`doc-ack-${index}`}>{ack.summary}</li>
				 )
			     } else {
				 return (

				     <li key={`doc-ack-${index}`}>Thanks to {getCredit(ack)} for supporting this vulnerability disclosure effort. </li>
				 )
			     }
			 })}
		     </ul>
		 </div>
		}
			     {csaf.document.references?.length > 0 &&
			      <>
				  <Card.Title>Document References</Card.Title>

				  <ul className="list-unstyled">
				      {csaf.document.references?.map((ref, index) => {
					  return(
					      <li key={`doc-ref-${index}`}><a target="_blank" rel="noreferrer" href={ref.url}>{ref.url}</a> <Badge pill bg="primary">{ref.category}</Badge></li>
					  )
				      })}
				  </ul>
			      </>
			     }
		     </Card.Body>
			 <Card.Footer>
			     <Card.Title>Document Revision History</Card.Title>
			     <hr />
			     <div className="mb-3">
				 <table className="table">
				     <thead>
					 <tr>
					     <th>Date</th>
					     <th>Version</th>
					     <th>Summary</th>
					 </tr>
				     </thead>
				     <tbody>
					 {csaf.document.tracking?.revision_history.map((rev, index) => (
					     <tr key={`rev-${index}`}>
						 <td>{formatInTimeZone(new Date(rev.date), 'UTC', 'yyyy-MM-dd')}</td>
						 <td>{rev.number}</td>
						 <td>{rev.summary}</td>
					     </tr>
					 ))}
				     </tbody>
				 </table>
			     </div>
			 </Card.Footer>

		</Card>
		}

	    </>
    );


}

export default AdvisoryPreviewApp;
