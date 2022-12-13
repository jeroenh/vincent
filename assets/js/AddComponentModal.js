import React from 'react';
import { Modal,Nav,  InputGroup, Tabs, Alert, Badge, Button, Form, Tab } from "react-bootstrap";
import { useRef, useState, useEffect, useContext } from 'react';
import ComponentAPI from './ComponentAPI.js'
import ComponentForm from './ComponentForm.js'
import DRFErrorMessage from './DRFErrorMessage';
import ComponentTypeahead from './ComponentTypeahead';
import ContactAPI from './ContactAPI';
import StandardPagination from './StandardPagination';
import axios from 'axios';
import CompContext from "./CompContext";

import "../css/casethread.css";

const componentapi = new ComponentAPI();
const contactapi = new ContactAPI();

const AddComponentModal = ({showModal, hideModal, title, edit, group, clone}) => {

    const isInitialMount = useRef(true);
    const {user, setUser} = useState(CompContext);
    const [error, setError] = useState(null);
    const [formContent, setFormContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [groupName, setGroupName] = useState("");
    const [activeTab, setActiveTab] = useState("detail");
    const [dependencies, setDependencies] = useState([]);
    const [removeList, setRemoveList] = useState([]);
    const [modalTitle, setModalTitle] = useState("");
    const [formValues, setFormValues] = useState({});
    const [component, setComponent] = useState(null);
    const [count, setCount] = useState(0);
    const [name, setName] = useState([]);
    const [drfError, setDRFError] = useState(null);
    const [versions, setVersions] = useState([]);
    const [version, setVersion] = useState([]);
    const [showSubmit, setShowSubmit] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Async Fetch
    const fetchInitialData = async () => {
	if (group) {
	    console.log("IN FETCH!!!");
	    let res = await contactapi.getMyGroup(group).then(response => {
		let data = response.data;
		setGroupName(data.name);
		/* this will prepopulate the "owner" field in the form */
		setComponent({'owner': data})
	    }).catch(err => {
		console.log(err);
		setError(`Error getting group information: ${err.response.data.message}`);
	    });
	}
	if (clone || edit) {
	    let component = edit ? edit : clone;
	    await componentapi.getComponent(component.component.id).then((response) => {
		
		setComponent(response.data);
		setLoading(false);
	    }).catch(err => {
		console.log('Error:', err)
	    });
        }
    }

    useEffect(() => {
	if (showModal) {
	    setError(null);
	    setActiveTab("detail");
	    setComponent(null);
	    setDRFError(null);
            fetchInitialData();
	    if (clone) {
		setModalTitle("Clone Component");
	    } else {
		setModalTitle(title);
	    }
	}
    }, [showModal]);

    /*useEffect(() => {
	if (showModal) {
	    fetchInitialData();
	}
    }, [edit]);

    useEffect(() => {
	setError(null);
    }, [hideModal]);
    */

    const handleSubmit = async (event) => {

	event.preventDefault();

	const formDataObj = formValues;

	if (!formDataObj.name) {
	    setError("Component name is required");
	    return;
	}
	
	if (clone) {
	    /* add the object being so we can copy dependencies */
	    formDataObj['clone'] = clone.component.id
	}
	    
	if (edit) {
	    await componentapi.updateComponent(edit.component.id, formDataObj).then((response) => {
		hideModal();
	    }).catch(err => {
		console.log(err);
		if (err.response?.data) {
                    setDRFError(err.response.data);
		} else {
		    setError(`Error editing component: ${err.message}`);
		}
	    });
	} else if (group) {
	    await componentapi.addGroupComponent(group, formDataObj).then((response) => {
		hideModal();
	    }).catch(err => {
		if (err.response?.data) {
                    setDRFError(err.response.data);
		} else {
		    setError(`Error adding component: ${err.message}`);
		}
	    });
	} else {
	    await componentapi.addComponent(formValues).then((response) => {
		hideModal();
	    }).catch(err => {
		console.log(err);
		if (err.response?.data) {
                    setDRFError(err.response.data);
		} else {
		    setError(`Unknown error adding component. ${err.message}`);
		}
	    });
	}

    }

    const removeDeps = async() => {
	const axiosArray = []

	setError(null);

	removeList.map(item => {
            let data = {'dependency': item.id, 'remove': 1}
            axiosArray.push(componentapi.addOneDependency(edit.component.id, data));
	});

	setLoading(true);
	setDependencies([]);
        let responses = await axios.all(axiosArray).then((response) => {
	    setRemoveList([]);
	    fetchDependencies();
	}).catch(err => {
	    if (err.response?.data) {
                setDRFError(err.response.data);
            } else {
                setError(`Error removing component: ${err.message}`);
            }
	});

    }


    const addDeps = async() => {

	const axiosArray = []

        setError(null);

	let deps = version;
	
	if (deps.length == 0) {
	    /* no version was selected - so select root component which is in name */
	    deps = [name[0].id];
	}
	
        deps.map(item => {
            let data = {'dependency': item}
            axiosArray.push(componentapi.addOneDependency(edit.component.id, data));
        });

        let responses = await axios.all(axiosArray).then((response) => {
	    setShowSubmit(false);
	    setVersions([]);
	    setName([]);
	    fetchDependencies();
	}).catch(err => {
	    if (err.response?.data) {
                setDRFError(err.response.data);
            } else {
		setError(`Error adding dependency: ${err.message}`);
	    }
        });
    }

	
    
    const fetchDependencies = async() => {

	let component = edit ? edit : clone;
	if (isInitialMount.current) {
	    isInitialMount.current = false;
	}
	await componentapi.getDependencies(component.component.id).then((response) => {
	    setDependencies(response.results);
	    setCount(response.count);
            setLoading(false);
        }).catch (err => {
            setLoading(false);
	    if (err.response?.status == 404) {
		setError("No dependencies found.");
	    } else if (err.response?.data?.detail) {
		setError(err.response?.data.detail);
	    } else {
		setError("Unable to retrieve dependencies");
	    }
            console.log(err);
        });
    }

    const fetchNextData = async () => {

        await componentapi.getDependencies(component.component.id, `page=${currentPage}`).then((response) => {
	    console.log(response);
            setDependencies(response.results);
            setCount(response.count);
            setLoading(false);
	}).catch(err => {
            console.log('Error:', err)

            setError(`Error retrieving components: ${err.response.data.detail}`);
	})
    }


    useEffect(()=> {
        if (isInitialMount.current)  {
            console.log("do nothing");
        } else {
            fetchNextData();
        }

    }, [currentPage])

    

    const setActiveTabNow = (props) => {
	if (activeTab != props && props == "deps") {
	    fetchDependencies();
	}
        setActiveTab(props);
    }

    const updateRemoveList = (elem) => {
	if (removeList.some(item => elem === item)) {
	    setRemoveList(removeList.filter(item => elem !== item));
	} else {
	    setRemoveList([...removeList, elem]);
	}
    }


    useEffect(() => {
	if (name.length > 0) {
	    if (name[0].versions) {
		setVersions(name[0].versions);
	    }
	    setShowSubmit(true);
	}
    }, [name])
    
    return (

	<Modal show={showModal} onHide={hideModal} size="xl" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
                <Modal.Title>{modalTitle}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
		{groupName && !edit &&
 		 <Alert variant="info">Adding component to {groupName}</Alert>
		}
		{error ?
                 <div className="alert alert-danger">{error}</div>
                 : ""}

		{drfError &&
                 <DRFErrorMessage
                     error={drfError}
                 />
                }      

		{clone &&
		 <div className="alert alert-info">You are cloning a component. Make sure to change <b>version</b> or <b>name</b> before submitting.</div>
		}

		{edit || clone ?
		 <Tab.Container
                     defaultActiveKey={"detail"}
                     activeKey = {activeTab}
		     id="component-detail-tabs"
                     onSelect={setActiveTabNow}
                 >

		     <Nav variant="pills" className="mb-3">
			 <Nav.Item key="detail">
			     <Nav.Link eventKey="detail">Detail</Nav.Link>
			 </Nav.Item>
			 {edit &&
			  <Nav.Item key="deps">
			      <Nav.Link eventKey="deps">Dependencies</Nav.Link>
			  </Nav.Item>
			 }
		     </Nav>
		     <Tab.Content id="detail">
			     
			 <Tab.Pane eventKey="detail" title="Detail">
			     {loading ?
			      <div className="text-center">
				  <div className="lds-spinner">
                                      <div></div>
                                      <div></div>
                                      <div></div>
				  </div>
                              </div>
			      :
			      <Form onSubmit={(e)=> handleSubmit(e)}>
				  <ComponentForm
				      update={setFormValues}
				      initial={component}
				      group={group}
				      user={user}
				  />
                              <div className="d-flex justify-content-end gap-2">
				  <Button variant="outline-secondary" type="button" onClick={(e)=>(hideModal())}>Cancel</Button>
				  
				  <Button variant="primary" type="submit">
				  Submit</Button>
                              </div>
			      </Form>
			     }
			     
			 </Tab.Pane>
			 {edit &&
		     <Tab.Pane eventKey="deps" title="Dependencies">
			 {loading ?
			  <div className="text-center">
			      <div className="lds-spinner"><div></div><div></div><div></div></div>
			  </div>
			  :
			  <>
			      
			      <Form.Group className="mb-3" controlId="_type">
				  <Form.Label>Add Dependency</Form.Label>                      
                                  <InputGroup>
				      <ComponentTypeahead
					  component = {name}
					  setComponent = {setName}
					  disabled = {false}
					  allowNew ={false}
				      />
				  </InputGroup>
			      </Form.Group>

			      {versions.length > 0 &&
			       <Form.Group controlId="version_multiselect" className="mb-3">
				   <Form.Label>Specific Version?</Form.Label>
				   <Form.Control as="select" multiple value={version} onChange={e => setVersion([].slice.call(e.target.selectedOptions).map(item => item.value))}>
				       {versions.map((v, index) => {
					   return (
					       <option key={`option-${index}`} value={v.id}>{v.version}</option>
					   )
				       })}
				   </Form.Control>
			       </Form.Group>
			      }

			      {showSubmit &&
			       <Button className="mb-3" variant="primary" onClick={(e)=>addDeps()}>Add Dependency</Button>
			      }
			       
			      {dependencies.length == 0 ?
			       <div><b>This component has 0 dependencies.</b></div>
			       
			       :
			       <>
				   <h5>{edit.component.name} Dependency List</h5>
				   <p>This component has <b>{count}</b> dependencies.</p>
			       </>
			      }
			      
			      <ul className="list-unstyled">
				  {dependencies.map((d, index) => {
				      return(
					  <li key={`dep-${index}`}><Button variant="btn-icon" className={removeList.some(elem=>elem==d) ? `warningtext`: `goodtext`} onClick={(e)=>updateRemoveList(d)}><i className="fas fa-minus-square"></i></Button>{d.name} {d.version}</li>
				      )
				  })}
			      </ul>
			      <StandardPagination
				  itemsCount={count}
				  itemsPerPage="20"
				  currentPage={currentPage}
				  setCurrentPage={setCurrentPage}
                              />
			      {removeList.length > 0 &&
			       <Alert variant="danger" className="d-flex align-items-center justify-content-between">
				   <p>Are you sure you want to remove these {removeList.length} dependencies?</p>
				   <Button onClick={(e)=>removeDeps()} variant="danger">Remove Dependencies</Button>
			       </Alert>
			      }

			  </>
			 }
		     </Tab.Pane>
		     }
		     </Tab.Content>
		 </Tab.Container>
		 :
		 <>
		     <Form onSubmit={(e)=> handleSubmit(e)}>
			 <ComponentForm
			     update={setFormValues}
			     initial={component}
			     group={group}
			     user={user}
			 />
			 <div className="d-flex justify-content-end gap-2">
                             <Button variant="outline-secondary" type="button" onClick={(e)=>(hideModal())}>Cancel</Button>

                             <Button variant="primary" type="submit">
                             Submit</Button>
			 </div>
		     </Form>

		     {/*
		     {formContent ?
                      <form onSubmit={(e) => handleSubmit(e)}>
                          <div dangerouslySetInnerHTML={{__html: formContent}} />

                          <div className="d-flex justify-content-end gap-2">
                              <Button variant="outline-secondary" type="button" onClick={(e)=>(hideModal())}>Cancel</Button>

                              <Button variant="primary" type="submit">
                              Submit</Button>
                          </div>
		      </form>
                      : <p>Loading...</p>

                      }
		      */}
		 </>
		}
	    </Modal.Body>
	</Modal>
    )

};

export default AddComponentModal;
