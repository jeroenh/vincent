import React from 'react'
import { useState, useEffect, useContext} from 'react';
import { Modal, Badge, OverlayTrigger, Tooltip, ListGroup, Tab, Tabs, Alert, Form, Button } from "react-bootstrap";
import AdminAPI from 'Components/AdminAPI';
import {format, formatDistance} from 'date-fns';
import CVSSSeverityBadge from 'Components/CVSSSeverityBadge';
import SSVCScore from 'Components/SSVCScore';
import 'Styles/casethread.css';

const adminapi = new AdminAPI();

const CVEPreviewApp = ({cveInfo, cve}) => {

    const [apiError, setApiError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copyStatus, setCopyStatus] = useState(null);
    const [cna, setCNA] = useState(null);
    const [description, setDescription] = useState(null);
    const [problemTypes, setProblemTypes] = useState([]);
    const [credits, setCredits] = useState([]);
    const [affected, setAffected] = useState([]);
    const [references, setReferences] = useState([]);
    const [datePublic, setDatePublic] = useState("");
    const [metrics, setMetrics] = useState([]);
    const [status, setStatus] = useState("");

    useEffect(() => {
        if (cveInfo?.cnaContainer) {
	    console.log(cveInfo);
            /* parse data */
            try {
                if ('descriptions' in cveInfo.cnaContainer) {
                    setDescription(cveInfo.cnaContainer.descriptions[0]?.value);
                } else if ('rejectedReasons' in cveInfo.cnaContainer) {
                    setDescription(`Rejected Reason: ${cveInfo.containers.rejectedReasons[0]?.value}`);
                }
                if ('affected' in cveInfo.cnaContainer) {
                    setAffected(cveInfo.cnaContainer.affected);
                } else {
		    setAffected([]);
		}
		if ('metrics' in cveInfo.cnaContainer) {
		    setMetrics(cveInfo.cnaContainer.metrics);
		}else {
		    setMetrics([]);
		}
                if ('problemTypes' in cveInfo.cnaContainer) {
		    let pt = [];
                    cveInfo.cnaContainer.problemTypes.forEach(item => {
			item.descriptions.forEach(d => {
			    console.log(d);
			    try {
				if ("type" in d && "cweId" in d && d.type.toLowerCase() === "cwe") {
				    pt.push(`${d.cweId} ${d.description}`);
				} else {
				    pt.push(d.description);
				}
			    } catch (err) {
				pass;
			    }
			});
		    })
		    console.log(pt);
                    setProblemTypes(pt);
                } else {
                    setProblemTypes([])
                }
		if ('references' in cveInfo.cnaContainer) {
		    setReferences(cveInfo.cnaContainer.references);
		}else {
                    setReferences([]);
		}
		if ('credits' in cveInfo.cnaContainer) {
		    setCredits(cveInfo.cnaContainer.credits)
		} else {
		    setCredits([]);
		}
		setLoading(false);
	    } catch (err){
                console.log(err);
            }
        } 
    }, [cveInfo])


    return (


	<>

	    <div className="mb-3"><b>CVE:</b>{" "}{cve} <a href={`https://nvd.nist.gov/vuln/detail/${cve}`} title="View CVE on NIST website" rel="noopener noreferrer" target="_blank"><i className="fas fa-external-link-alt"></i></a></div>
	    {cveInfo?.cnaContainer &&
	     <>
		 <div className="mb-3"><b>Date Public:</b>{" "}{format(new Date(cveInfo.cnaContainer.datePublic), 'yyyy-MM-dd HH:mm')}</div>
		 {cveInfo.cnaContainer.tags &&
		  
		  <div className="mb-3">
		      <b>Tags:</b>{" "}
		      {cveInfo.cnaContainer.tags.join(', ')}
		  </div>
		 }
	     </>
	    }
	    <div className="mb-3"><b>Description:</b><br/>
		{description}
	    </div>
	    <div><b>Problem Types:</b>
		<ul className="list-unstyled">
		    {problemTypes?.length > 0 ? (
			problemTypes.map((t, index) => {
			    return (
                                <li key={`pt-${index}`}>{t}</li>
			    )
                            })
			) :
			 <>
			 </>
			}
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
			     } else if (key.startsWith("other") && cvss[key].type == "ssvc") {
				 return (
				     <div key={`metrics-ssvc-${key}`} className="mb-3">
					 <div><b>SSVC {cvss[key].content.version}:</b></div>
					 <div><b>Scored on:</b> {format(new Date(cvss[key].content.timestamp), 'yyyy-MM-dd HH:mm')}</div>
					 {cvss[key].content.options.map((x, i) => (
					     <div key={`metrics-ssvc${i}`}>
						 {Object.entries(x).map(([key, value]) => (
						     <span key={key}><b>{key}</b>: {value}</span>
						 ))}
					     </div>
					 ))}
				     </div>
				 )
			     }
								    
			 })
		     ))}
		 </div>
		}
		{references?.length > 0 ? (
		    <div><b>References:</b>
			<ul className="list-unstyled">
			    {references.map((t, index) => {
				return (
				    <li key={`ref-${index}`}><a href={`${t.url}`} rel="noopener noreferrer" target="_blank">{t.url}</a>  {t.tags?.map((tag, idx) => (<Badge bg="primary" className="mx-1" key={`reftag-${index}-${idx}`}>{tag}</Badge>))}</li>
				)
			    })}
			</ul>
		    </div>
		) :
		 <>
		 </>
		}

		{credits?.length > 0 &&
		 <div><b>Credits:</b>
		     <ul className="list-unstyled">
			 {credits.map((t, index) => {
                             return (
				 <li key={`credit-${index}`}><OverlayTrigger overlay={<Tooltip>{copyStatus === `${t.value} (${t.type})` ? `Copied!` : `Click to Copy`}</Tooltip>}><span className="clicktocopy" onClick={() => {navigator.clipboard.writeText(`${t.value} (${t.type})`), setCopyStatus(`${t.value} (${t.type})`)}}>{t.value} {t.type && `(${t.type})`}</span></OverlayTrigger></li>
                             )
			 })}
                     </ul>
		 </div>
		}
		<div className="modal-table">
		    <div><b>Affected Products:</b></div>

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
			    {affected?.length > 0 ? (
				affected.map((t, index) => {
				    return (
					t.versions ?
					    <React.Fragment key={`affected-${index}`}>
						{t.versions.map((v, ind) => {
						    return (
							<tr key={`affectedprod-${index}-${ind}`}>
							    <td>{t.product ? `${t.product}` : `${t.packageName}`}
								{t.cpes?.length > 0 &&
								 <>
								     <br/>
								     <span className="fw-bolder">{t.cpes[0]}</span>
								     {t.cpes.length > 1 &&
								      <>
									  <br/>
								      <OverlayTrigger
									  placement="left"
									  trigger="click"
									  overlay={
									      <Tooltip className="cpe-tooltip">
										  {t.cpes.map((cpe, idx) => (
										      <React.Fragment key={`cpe-${ind}-${idx}`}>
											  {cpe}<br/>
										      </React.Fragment>
										  ))}
									      </Tooltip>
									  }
								      >
									  <Button variant="primary" size="xs">
									      + {t.cpes.length - 1} CPEs
									  </Button>
								      </OverlayTrigger>
								      </>
								     }
								 </>
								}
							    </td>
							    <td>{t.vendor ? `${t.vendor}` : <a href={`${t.collectionURL}`} target="_blank" rel="noopener noreferrer">{t.collectionURL}</a>}</td>
							    <td>{v.version} {v.lessThan ?
									     `< ${v.lessThan}`
									     :
									     <>
										 {v.lessThanOrEqual &&
										  `<= ${v.lessThanOrEqual}`
										 }
									     </>
									    }
							    </td>
							    <td>{v.status}</td>
							</tr>
						    )
						})}
					    </React.Fragment>
					:
					<React.Fragment key={`affected=${index}`}>
					    <tr>
						<td>{t.product ? `${t.product}` : `${t.packageName}`}
						    {t.cpes?.length > 0 && <br/>}
					     	    {t.cpes?.map((cpe, idx) => (
							<span className="fw-bolder" key={`cpe${index}-${idx}`}>{cpe}</span>
                                                    ))}
						</td>
						<td>{t.vendor ? `${t.vendor}` : <a href={`${t.collectionURL}`} target="_blank" rel="noopener noreferrer">{t.collectionURL}</a>}
						</td>
						<td>{t.lessThan ?
                                                     `< ${t.lessThan}`
                                                     :
                                                     <>
                                                         {t.lessThanOrEqual &&
                                                          `<= ${t.lessThanOrEqual}`
                                                         }
                                                     </>
                                                    }</td>
						<td>{t.defaultStatus}</td>
					    </tr>
					</React.Fragment>
				    )
				})
			    ) :
			     <tr><td colSpan="4">No Products Defined</td></tr>


			    }
			</tbody>
		    </table>
		</div>
	    </>
    )
}

export default CVEPreviewApp;
