import React from 'react';
import { Accordion, Modal, Table, Tabs, Alert, Badge, Button, Form, Tab } from "react-bootstrap";
import { useState, useEffect } from 'react';
import ComponentAPI from './ComponentAPI.js'
import { format, formatDistance } from 'date-fns'

const componentapi = new ComponentAPI();

const StatusModal = (props) => {

    const [error, setError] = useState(null);
    const [component, setComponent] = useState(null);
    const [vulStatus, setVulStatus] = useState(null);
    const [selectedVul, setSelectedVul] = useState(null);
    const [revisions, setRevisions] = useState([]);
    const [formContent, setFormContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("detail");
    const [vex, setVex] = useState("");
    const [owner, setOwner] = useState(false);
    
    const fetchActivity = async () => {
	console.log("fetching component status");
	try {
            await componentapi.getComponentStatusActivity(vulStatus.id).then((response) => {
		console.log(response);
                setRevisions(response);
            })
        } catch (err) {
            console.log('Error:', err)
        }
    }

    const createVexStatement = () => {
	const build_vex = {};
	const stmts = [];

	const products = {'affected': [], 'fixed': [], 'under_investgation': []}
	console.log(component);
	console.log(vulStatus);
	build_vex['@context'] =  "https://openvex.dev/ns"
	build_vex['@id'] = window.location.href;
	build_vex['author'] = vulStatus.user?.name || "Unknown";
	build_vex['role'] = "Document Creator";
	build_vex['timestamp'] = vulStatus.modified;
	build_vex['version'] = vulStatus.revision_number;

	vulStatus.status.forEach((v, index) => {
	    let lstatus = v.status.toLowerCase().replace(" ", "_");
	    if (lstatus == "not_affected") {
		let just = v.justification.toLowerCase().replaceAll(" ", "_");
		stmts.push({"vulnerability": {"name": vulStatus.vul.vul},
                            "products": [{"@id": `${component.component.name} ${v.version_value}`}],
                            "status": "not_affected",
                            "justification": just})
	    } else {
     		products[lstatus].push({"@id": `${component.component.name} ${v.version_value}`});

	    }
	})

	Object.keys(products).forEach((item) => {
	    if (products[item].length > 0) {
		stmts.push({"vulnerability": {"name": vulStatus.vul.vul},
			    "products": products[item],
			    "status": item});
	    }
	});

	build_vex['statements'] = stmts;
	setVex(build_vex);
	setLoading(false);
    }

    const setActiveTabNow = (props) => {
	if (props == "activity" && vulStatus) {
	    fetchActivity();
	} else if (props == "vex") {
	    createVexStatement();
	}
        setActiveTab(props);
    }

    useEffect(() => {
	if (props.showModal) {
	    setComponent(props.component);
	    setVulStatus(props.status);
	    setActiveTab("detail");
	    if (props.vuls) {
		let selVul = props.vuls.filter((item) => item.id == props.status.vul.id)
		setSelectedVul(selVul[0]);
	    }

	    let groups = props.user.groups?.map(x => x.name);
	    if (props.user.role === "owner" || groups.includes(props.component.component.owner?.name)) {
		setOwner(true);
	    } else {
		setOwner(false);
	    }
	}

    }, [props.showModal]);

    return (
	props.showModal ?
	<Modal show={props.showModal} onHide={props.hideModal} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>Component Status Detail</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		{error ?
                 <div className="alert alert-danger">{error}</div>
                 : ""}

		<Tabs
                    defaultActiveKey={"detail"}
                    activeKey = {activeTab}
		    id="status-detail-tabs"
                    onSelect={setActiveTabNow}
                >
                    <Tab eventKey="detail" title="Detail">
			{component && vulStatus &&

			 <>
			     <h3>{component.component.owner && component.component.owner.name}
			     <span className="fw-light">{" "}{component.component.name}</span></h3>

			     <p><b>{vulStatus.vul.vul}</b>: {selectedVul && selectedVul.description}</p>

			     <Table>
				 <thead>
				     <tr>
					 <th>Version</th>
					 <th>Status</th>
					 <th>Remediation/Justification</th>
				     </tr>
				 </thead>
				 <tbody>
				     {vulStatus.status.map((item, index) => (
					 <tr key={`${status}-${index}`}>
					     <td>{item.version_value}{item.version_range}{item.version_end_range}</td>

					     <td>{item.status}</td>
					     <td className="text-break"> {item.remediation_category ?
                                                   <span>{item.remediation_category}: {item.remediation_detail}</span>
                                                   :
						   <>
						       {item.justification &&
							
							<span>{item.justification}</span>
						       }
						   </>
						  }
					     </td>
					 </tr>
				     ))}
				 </tbody>
			     </Table>
			     {vulStatus.statement &&
			      <div className="mb-2 text-break"><b>Statement:</b> {vulStatus.statement}</div>
			     }
			     {owner &&
			      <div><i>Status provided by {vulStatus.user?.name} on {format(new Date(vulStatus.modified), 'yyyy-MM-dd HH:SS')}.</i></div>
			     }

			     {/*
			 {component.component.products.length > 0 &&
			  <>
			      <b>This component is contained in {component.component.products.length} other components: </b>
			      <ul>
				  {component.component.products.map((c, index) => {
				      return (
					  <li>{c.name}</li>
				      )
				  })}
			      </ul>
			  </>
			 }*/}
			 </>
			 }
			     </Tab>
			     {owner &&
		    <Tab eventKey="activity" title="Activity">
			<Accordion>
			    {revisions.map((rev, index) => {
				let created = new Date(rev.created);
				let num_changes = Object.keys(rev.diff).length;
				if (num_changes > 0) {
				return (
				    <Accordion.Item eventKey={index} key={`rev-${rev.revision_number}`}>
					<Accordion.Header>
					    <div>
						<i className="fas fa-plus"></i>
						<span className="px-2">#{rev.revision_number} {format(created, 'yyyy-MM-dd')} by {rev.user} <b>{num_changes} changes</b></span>
						{rev.approved &&
						 <Badge bg="success" className="mw-2">Approved</Badge>

						}
					    </div>
					</Accordion.Header>
					<Accordion.Body>
					    {Object.entries(rev.diff)
					     .map( ([key, value]) => {
						 if (["stmt_diff", "status_diff"].includes(key)) {
						     if(value.length > 0) {
							 return (
							     <Table key={`diff-table-${index}`}>
							     <tbody>
								 {
								     value.map((post, index) => {
									 let firstchar = post.charAt();
									 let cn = "equal";
									 switch(firstchar) {
									 case "-":
									     cn = "delete";
									     break;
									 case "0":
									 case "+":
									     cn="insert";
									     break;
									 case "?":
									     cn="skip";
									     break;
									 default:
									     break;
									 }
								if (cn != "skip") {
								    return (
									<tr className={cn} key={index}>
									    <td><div dangerouslySetInnerHTML={{__html: post}} /></td>
									</tr>
								    )
								}
								     })
								 }
							     </tbody>
							 </Table>
							 )
						     }
						 } else {
						     return (
							 <p>{value}</p>
						     )
						 }
					     })
					    }
					</Accordion.Body>
				    </Accordion.Item>
				
				)
				}
			    })}
			</Accordion>
		    </Tab>
			     }
		    <Tab eventKey="vex" title="Vex">
			{loading ?
			 <div className="text-center">
			     <div className="lds-spinner"><div></div><div></div><div></div></div>
			 </div>
			 :
			 <>
			     <pre>
				 {JSON.stringify(vex, null, 2)}
			     </pre>
			 </>
			}
		    </Tab>
		</Tabs>
	    </Modal.Body>
	    <Modal.Footer>
		{activeTab == "vex" ?
		 <Button variant="outline-primary" href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(vex, null, 2))}`} download={`vex_${component.component.name.replace(/ /g, "_")}.json`}><i className="fas fa-download"></i> Download</Button>
		 :
		 <Button variant="primary" data-testid="close-status-modal" onClick={props.hideModal}>Close</Button>
		}
	    </Modal.Footer>

	</Modal>
	:
	""
    )

};

export default StatusModal;
