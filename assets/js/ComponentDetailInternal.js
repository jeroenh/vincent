import React from 'react';
import { Alert, Badge, Card, Nav, ListGroup, Dropdown, Row, Col, Table, Tab, Button, Tabs, Form, DropdownButton } from "react-bootstrap";
import { useContext, useState, useEffect } from 'react';
import {Link, useLocation} from "react-router"
import CompContext from "./CompContext.js";
import ActivityApp from './ActivityApp.js';
import '../css/casethread.css';
import ComponentAPI from './ComponentAPI';
import DisplayVulStatus from './DisplayVulStatus';
import AddComponentModal from './AddComponentModal';
import DeleteConfirmation from "./DeleteConfirmation";
import SelectGroupModal from "./SelectGroupModal";
import ComponentDependencyTable from "./ComponentDependencyTable";

const componentapi = new ComponentAPI();

const DETAIL_FIELDS = ['id', 'name', 'component_type', 'source', 'versions', 'owner', 'sbom_id', 'version',
		       'contained_in', 'external_ids', 'purl', 'comment', 'homepage', 'checksum', 'supplier', 'swid', 'cpe', 'tags']

const ComponentDetailInternal = ({component, loadactivity, updateComponent}) => {

    const {user, setUser} = useContext(CompContext);
    const [loading, setLoading] = useState(true);
    const [cases, setCases] = useState([]);
    const [dependencies, setDependencies] = useState([]);
    const [activeTab, setActiveTab] = useState("detail");
    const [casesError, setCasesError] = useState(null);
    const [activityError, setActivityError] = useState(null);
    const [activity, setActivity] = useState([]);
    const [selectFormat, setSelectFormat] = useState(false);
    const [format, setFormat] = useState("json");
    const [sbomError, setSbomError] = useState(null);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [addComponentModal, setAddComponentModal] = useState(false);
    const [editComponent, setEditComponent] = useState(null);
    const [error, setError] = useState(null);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [selected, setSelected] = useState([]);
    
    // Async Fetch
    const fetchCases = async () => {
	let compid = component.id ? component.id : component.component.id;
	await componentapi.getComponentCases(compid).then((response) => {
            console.log(response);
	    setCases(response);
            setLoading(false);
        }).catch (err => {
	    setLoading(false);
	    setCasesError(err.message);
	    console.log(err);
	});
    }

    const showDeleteModal = () => {
        /*get selected rows and add them to removeid */
        setDeleteMessage(`Are you sure you want to remove this component?`);
        setDisplayConfirmationModal(true);
    };

    useEffect(() => {
        if (editComponent) {
            setAddComponentModal(true);
        }
    }, [editComponent]);


    const hideComponentModal = () => {
        setAddComponentModal(false);
        setEditComponent(null);
	updateComponent();
    };


    const hideGroupModal = () => {
        setShowGroupModal(false);
	updateComponent();
    };


    const ComponentObject = ({object}) => {

	return (
	    Object.entries(object)
		.map( ([key, value]) => {
		    if (value) {
			if (key === "component" && typeof value === "object") {
			    return (
				<div key={`${key}-obj`}>
				    <ComponentObject
					object = {value}
				    />
				</div>
			    )
			} else {
			    if (DETAIL_FIELDS.includes(key)) {
				return (
				    <React.Fragment key={`${key}-comp`}>
					{ Array.isArray(value) ?
					  <>
					      {value.length > 0 &&
					       <div className="mt-2" key={`${key}-comp}`}><label className="form-label">{key}:</label>
						   <br/><ul>
							    {value.map((v, index) => {
								if (typeof v === "object") {
								    if (v.id) {
									return (
									    <li key={`${v.name}-${index}`}><Link to={`/cvdp/components/${v.id}`} state={{previous: component.id? component: component.component}}>{v.name} {v.version}</Link></li>
									)
								    } else if (v.name) {
									return (
									    <li key={`${v.name}-${index}`}>{v.name} {v.version}</li>
									)
								    } else {
									return (
									    <React.Fragment key={`${key}-${index}`}>
										<ComponentObject
										    object={v}
										/>
									    </React.Fragment>
									)
								    }
								} else if (key === "tags"){
								    return (
									<li key={`tag-${index}`}><Badge bg="primary">{v}</Badge></li>
								    )

								} else {
								    return (
									<li key={`${v}-${index}`}>{v}</li>
								    )
								}
							    })
							    }
							</ul>
					       </div>
					      }
					  </>
					  :
				      
				      <div className="mt-2" key={`${key}-comp}`}><label className="form-label">{key}:</label>
				      {typeof value === "object" ?
				       <span className="m-2"><b>{value.name} {value.version}</b></span>
				       :
				       <span className="m-2"><b>{value}</b></span>
				      }
				  </div>
				    }
				    </React.Fragment>
				)
			    }
			}
		    }
		})
	)
    }

    

    const submitRemoveComponent = async() => {

	let compid = component.id ? component.id : component.component.id;
	
        await componentapi.removeComponents([compid]).then((response) => {
	    window.location="/cvdp/components/";
        }).catch(err => {
            setError(`Error removing components: ${err.response.data.detail}`);
        })
        setDisplayConfirmationModal(false);
    };
    
    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    useEffect(() => {
	/* make this look like selected rows from component table */
	let s = {'original': component}
	setSelected([s]);
	
	setActiveTab("detail");
	setCases([]);
	setActivity([]);
	setSbomError(null);
	setCasesError(null);
	setActivityError(null);
    }, [component]);

    //Async fetch activity
    const fetchActivity = async () => {

	let compid = component.id ? component : component.component;
	await componentapi.getComponentActivity(compid).then((response) => {
	    console.log(response);
	    setActivity(response.results);
	    setLoading(false);
	}).catch(err=> {
	    setLoading(false);
	    setActivityError(err.response.data.detail);
	});
    }

    const downloadSBOM = async (e) => {
	try {
	    /* make sure errors get handled properly */
	    let response = await componentapi.getSPDX(component, e);
	    let data = await response.data;
	    const url = window.URL.createObjectURL(new Blob([data],
							    { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download',
			      response.headers["content-disposition"].split("filename=")[1]);
            document.body.appendChild(link);
            link.click();
	} catch (err) {
	    let statusCode = err.response.status
	    let responseObj = await err.response.data.text();
	    let json = JSON.parse(responseObj);
	    setSbomError(json['error']);

	}
    }


    const setActiveTabNow = (props) => {
	setLoading(true);
        if (props == "cases") {
	    fetchCases();
	} else if (props == "activity") {
	    fetchActivity();
	}

	setActiveTab(props);
    }

    if (component) {
	return (
	    <Tab.Container
                defaultActiveKey={"detail"}
		activeKey = {activeTab}
		className="mb-3"
		onSelect={setActiveTabNow}
            >
		<Nav variant="pills" className="mb-3">
		    <Nav.Item key="detail">
			<Nav.Link eventKey="detail">Detail</Nav.Link>
		    </Nav.Item>
		    {component.permissions=="rw" &&
		     <>
			 {loadactivity ?
			  ""
			  :
			  <Nav.Item key="dependencies">
			      <Nav.Link eventKey="dependencies">Dependencies</Nav.Link>
			  </Nav.Item>
			 }
			 <Nav.Item key="cases">
			     <Nav.Link eventKey="cases">Cases</Nav.Link>
			 </Nav.Item>
			 
			 {loadactivity &&
			  <Nav.Item key="activity">
			      <Nav.Link eventKey="activity">Activity</Nav.Link>
			  </Nav.Item>
			 }
			 <Nav.Item key="sbom">
			     <Nav.Link eventKey="sbom">SBOM</Nav.Link>
			 </Nav.Item>
		     </>
		    }
		</Nav>
		<Tab.Content className="p-0">
		    <Tab.Pane eventKey="detail" key="detail">
			<Card className="p-0">
			    {loadactivity ?
			     ""
			     :
			     <Card.Header>
				 <div className="d-flex justify-content-between">
				     <Card.Title>Component Detail</Card.Title>
				     {component.permissions == "rw" &&
                                     <DropdownButton variant="btn p-0"
                                                     title={<i className="bx bx-dots-vertical-rounded"></i>}>
                                         <Dropdown.Item eventKey="edit" onClick={()=>(setEditComponent(component))}>Edit Component</Dropdown.Item>
					 <Dropdown.Item eventKey="delete" onClick={()=>(showDeleteModal())}>Delete Component</Dropdown.Item>
					 {component.owner == "" &&
					  <Dropdown.Item eventKey="add" onClick={()=>(setShowGroupModal(true))}>Add Owner</Dropdown.Item>
					 }
                                     </DropdownButton>
				     }
                                 </div>
			     </Card.Header>
			    }
			    <Card.Body>
				{component.owner != "" ?
				 ""
				 :
				 <Alert variant="danger">This component does not have an owner.</Alert>
				}

				<ComponentObject
				    object = {component}
				/>

			    </Card.Body>
			</Card>
		    </Tab.Pane>
		    {component.permissions == "rw" &&
		     <>
			{loadactivity ?
			 ""
			 :
			 <Tab.Pane eventKey="dependencies" key="dependencies">
			     {activeTab == "dependencies" &&
			      <ComponentDependencyTable
				  component = {component}
			      />
			     }
			 </Tab.Pane>
			}
			
			<Tab.Pane eventKey="cases" key="cases">
			    <Card className="p-0">
				<Card.Body>
				    {loading ?
				     <div className="text-center"><div className="lds-spinner"><div></div><div></div><div></div></div></div>
				     :
				     <>{casesError ?
					<Alert variant="danger">{casesError}</Alert>
					:
					
					<Table>
					    <thead>
						<tr>
						    <th>
							Case
						    </th>
						    <th>
							Vul
						    </th>
						    <th>
							Version Status
						    </th>
						</tr>
					    </thead>
					    <tbody>
						{cases.length == 0 &&
						 <tr><td colSpan="3" className="text-center"><b>No cases</b></td></tr>
						}
						{cases.map((c, index) => {
						    return (
							<tr key={`case-component-${index}`}>
							    <td><a href={`/cvdp/vul/${c.vul.id}/`}>{c.vul.case}</a></td>
							    <td>{c.vul.vul}</td>
							    <td>{c.status.map((item, index) => (
								<React.Fragment key={`status-${index}`}>
								    {item.version_value}
								    {item.version_range &&
								     `${item.version_range} ${item.version_end_range}`
								    }
								    {" "}
								    <DisplayVulStatus
									status={item.status}
								    />
								    <br/>
								</React.Fragment>
							    ))}
							    </td>
							</tr>
						    )
						})
						}
					    </tbody>
				    </Table>
				       }
				     </>
				    }
				</Card.Body>
			    </Card>
			</Tab.Pane>
			{loadactivity &&
			 <Tab.Pane eventKey="activity" key="Activity">
			     <Card className="p-0">
				 <Card.Body>
				     {loading ?
				      <div className="text-center"><div className="lds-spinner"><div></div><div></div><div></div></div></div>
				      :
				      <>
					  {activityError ?
					   <Alert variant="danger">{activityError}</Alert>
					   :
					   <ListGroup variant="flush">
					       {activity.length == 0 &&
						<ListGroup.Item>No activity</ListGroup.Item>
					       }
					       {activity.map((a, index) => {
						   return (
						       <ListGroup.Item className="p-2 border-bottom" key={`activity-${index}`}>
							   <ActivityApp
							       activity = {a}
							   />
						       </ListGroup.Item>
						   )
					       })}
					   </ListGroup>
					  }
				      </>
				     }
				 </Card.Body>
			     </Card>
			 </Tab.Pane>
			}
			<Tab.Pane eventKey="sbom" key="SBOM">
			    <Card>
				<Card.Body>
				    {component.version && component.source && component.source !== "NOASSERTION" ?
				     <Dropdown onSelect={(e)=>downloadSBOM(e)}>
					 <Dropdown.Toggle className="button-toggle-dropdown">
					     Download
					 </Dropdown.Toggle>
					 <Dropdown.Menu>
					     <Dropdown.Item eventKey="json">
						 JSON
					     </Dropdown.Item>
					     <Dropdown.Item eventKey="xml">XML</Dropdown.Item>
					     <Dropdown.Item eventKey="yaml">YAML</Dropdown.Item>
					     <Dropdown.Item eventKey="rdf">RDF</Dropdown.Item>
					 </Dropdown.Menu>
				     </Dropdown>
				     :
				     <Alert variant="info">Component must have version and source (download location) before SBOM can be generated.</Alert>
				    }
				    {sbomError &&
				     <Alert variant="danger" className="my-2">{sbomError}</Alert>
				    }
				    <Table>
					<thead>
					    <tr>
						<td>File</td>
						<td>Date</td>
						<td>Generated by</td>
						<td>Action</td>
					    </tr>
					</thead>
					<tbody>
					</tbody>
				    </Table>
				</Card.Body>
			    </Card>
			</Tab.Pane>
		    </>
		    }
		    
		</Tab.Content>
		<AddComponentModal
                    showModal = {addComponentModal}
                    hideModal = {hideComponentModal}
                    title = {editComponent? "Edit Component" : "Add Component"}
                    edit = {editComponent}
		    user={user}
		/>                                                                          
		<DeleteConfirmation
                    showModal={displayConfirmationModal}
                    hideModal={hideConfirmationModal}
		    confirmModal={submitRemoveComponent}
                    id={component.id ? component.id : component.component.id}
                    message={deleteMessage} />
		<SelectGroupModal
		    showModal = {showGroupModal}
		    hideModal = {hideGroupModal}
		    selected= {selected}
		/>
	    </Tab.Container>
	)
    }


};

export default ComponentDetailInternal;
