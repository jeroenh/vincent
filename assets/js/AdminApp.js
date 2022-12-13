import React, { useState, useEffect } from 'react';
import {Nav, Table, Modal, Dropdown, DropdownButton, Alert, Button, Tab, Tabs, Row, Form, Card, Col} from 'react-bootstrap';
import {Typeahead} from 'react-bootstrap-typeahead';
import AdminAPI from './AdminAPI';
import ThreadAPI from './ThreadAPI';
import DeleteConfirmation from "./DeleteConfirmation";
import DisplayLogo from "./DisplayLogo";
import GroupTypeahead from './GroupTypeahead';

import '../css/casethread.css';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';

const adminapi = new AdminAPI();
const threadapi = new ThreadAPI();

const AdminApp = () => {
    const [activeTab, setActiveTab] = useState(null);
    const [roles, setRoles] = useState([]);
    const [apiError, setApiError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [removeID, setRemoveID] = useState(null);
    const [editRole, setEditRole] = useState(null);
    
    const fetchInitialData = async () => {

	await adminapi.getAssignments().then((response) => {
	    setRoles(response);
	    console.log(response);
	    setIsLoading(false);
        }).catch(err => {
	    console.log(err);
	    setApiError(err.message);
	})

	await threadapi.getUserAssignments().then((response) => {
	    setUsers(response['users']);
	    setTeams(response['teams']);
	}).catch(err => {
	    console.log(err);
	    setApiError(err.message);
	});
    };

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }

    const hideFormModal = () => {
	setShowForm(false);
	fetchInitialData();
    }


    useEffect(() => {
	if (editRole) {
	    setShowForm(true);
	}
    }, [editRole])

    
    const submitRemoveRole = async (id) => {
	await adminapi.removeRole(id).then((response) => {
	    fetchInitialData();
        }).catch(err => {
            setApiError(`Error with removing role ${err.message}`);
            console.log(err);
        });
        setDisplayConfirmationModal(false);
    }

    useEffect(() => {
	setActiveTab("roles")
	fetchInitialData();
    }, []);


    const AddRoleModal = (props) => {

	const [roleName, setRoleName] = useState("");
	const [error, setError] = useState(null);
	const [group, setGroup] = useState([]);

	const handleSubmit = async(event) => {
            event.preventDefault();
            const formData = new FormData(event.target),
		  formDataObj = Object.fromEntries(formData.entries());
            console.log(formDataObj);
	    if (group.length > 0) {
		console.log(group);
		formDataObj['group'] = group[0].uuid;
	    }

	    if (props.editRole) {

	        await adminapi.editRole(props.editRole.id, formDataObj).then(response => {
		    props.hideModal();
		}).catch(err =>  {
		    console.log(err);
		    setError(`Error adding role: ${err.response.data.message}`);
		});	
	    } else {
		
		await adminapi.addRole(formDataObj).then(response => {
		    props.hideModal();
		}).catch(err =>  {
		    console.log(err);
		    setError(`Error adding role: ${err.response.data.message}`);
		});
	    }
	}

	useEffect(() => {
	    if (props.editRole) {
		setRoleName(props.editRole.role);
		if (props.editRole.group) {
		    setGroup([props.editRole.group]);
		}
	    }
	}, [props.editRole])
	

	return (

	    <Modal show={props.showModal} onHide={props.hideModal} size="lg" centered>
		<Modal.Header closeButton className="border-bottom">
		    <Modal.Title>{props.editRole ? "Edit" : "Add New"} Role</Modal.Title>
		</Modal.Header>
		<form onSubmit={(e)=>handleSubmit(e)}>
		    <Modal.Body>
			{error ?
			 <div className="alert alert-danger">{error}</div>
			 : ""}


			<Form.Group className="mb-3" controlId="roleNameInput">
			    <Form.Label>Role Name<span className="required">*</span></Form.Label>
			    <Form.Control title="Provide role name" type="text" name="role" value={roleName} onChange={(e)=>setRoleName(e.target.value)} />
			</Form.Group>
			<Form.Group controlId="groupNameInput">
			    <Form.Label>Select Group:</Form.Label>
                            <GroupTypeahead
				owner = {group}
				setOwner ={setGroup}
				options = {props.options}
                            />
			</Form.Group>
		    </Modal.Body>
		    <Modal.Footer>
			<div className="d-flex justify-content-end gap-2">
			    <Button variant="secondary" onClick={(e)=>props.hideModal()}>
			    Cancel</Button>
			    <Button variant="primary" type="submit">
			    Submit</Button>
			</div>
		    </Modal.Footer>
		</form>
	    </Modal>
	)
    }


    const RoleCard = (props) => {
	const {role} = props;
	const [showForm, setShowForm] = useState(false);
	const [addUser, setAddUser] = useState("");
	const [error, setError] = useState("");
	const [showError, setShowError] = useState(false);
	const [showRemove, setShowRemove] = useState(false);
	const [weight, setWeight] = useState(1);
	const [badUser, setBadUser] = useState(false);
	const [availableUsers, setAvailableUsers] = useState([]);
	
	function submitUser() {
	    console.log(addUser);
	    if (addUser) {
		const data = {'user': addUser[0].uuid, 'weight': weight}
		try {
		    adminapi.addAssignment(role.id, data).then((response) => {
			fetchInitialData();
		    });
		} catch (err) {
		    setError("Error adding user");
		}
	    } else {
		setBadUser(true);
	    }
	}

	function removeAssignment(user) {
            const data = {'user': user.userid, 'delete': 1}
            try {
                adminapi.removeAssignment(role.id, data).then((response) => {
                    fetchInitialData();
                });
            } catch (err) {
                setError("Error adding user");
            }
        }

	useEffect(()=> {
	    if (error) {
		setShowError(true);
	    }
	}, [error]);


	useEffect(() => {

	    if (role.group) {
		let a = users.filter(x => x.groups?.includes(role.group.name));
		setAvailableUsers(a);
	    } else {
		/* group is global - so all users are game */
		setAvailableUsers(users);
	    }
		
	}, [role]);

	return (
            <Col>
                <Card key={role.id}>
                    <Card.Header as="h5" className="d-flex justify-content-between">
                        <Card.Title>Role: {role.role}
                        </Card.Title>
			<DropdownButton variant="btn p-0"
					title={<i className="bx bx-dots-vertical-rounded" title="Add or remove users from role"></i>}>
                            <Dropdown.Item eventKey="add" onClick={(e)=>setShowForm(true)}>Add User to Role</Dropdown.Item>
			    <Dropdown.Item eventKey="rm" onClick={(e)=>setShowRemove(true)}>Remove Users</Dropdown.Item>
			</DropdownButton>
                    </Card.Header>
                    <Card.Body>
			{showError &&
			 <Alert variant="danger">{error}</Alert>
			}

                        {role.users.length > 0 ?
			 <table className="table">
			     <tbody>
			     <tr>
				 <td>
				     <b>User</b>
				 </td>
				 <td><b>Weight</b></td>
				 <td><b>Probability</b></td>
				 <td></td>
			     </tr>

                             {role.users.map((u, index) =>
                                 <tr key={index}><td>{ u.name }</td>
				     <td>{u.weight}</td>
				     <td>{u.probability}</td>
				     <td>{showRemove &&
					  <Button variant="btn p-0" onClick={(e)=>removeAssignment(u)}>
					      <i className="fas fa-times" title="Remove assignment"></i>
					  </Button>
					 }</td>
				 </tr>
                             )}
			     </tbody>
                         </table>
                         :
                         <b>No users assigned.</b>
                        }

                    </Card.Body>
			{showForm &&
			 <>
			     <hr/>
			     <Card.Body>

				 <Row>
				     <Col lg={8}>
					 <Form.Label>User</Form.Label>
					 <Typeahead
					     options={availableUsers}
					     labelKey="name"
					     id="addusers"
					     onChange={setAddUser}
					     placeholder="Start typing user"
					 />
					 {badUser &&
					 <Form.Text className="error">
                                             This field is required.
                                         </Form.Text>
					 }
				     </Col>
				     <Col lg={4}>
					 <Form.Label>Weight</Form.Label>
					 <Form.Control type="number" min={1} max={5} step={1} onChange={(e)=>setWeight(e.target.value)} value={weight} />
				     </Col>
				 </Row>
				 <Row className="mt-2">
				     <Col lg={12} className="text-end">
				     <Button variant="btn btn-outline-secondary" onClick={(e)=>submitUser()}>
					 <i className="fas fa-check" title="Add User to Role"></i>
				     </Button>
				     <Button variant="secondary" onClick={(e)=>setShowForm(false)}>
					 <i className="fas fa-times" title="Cancel add user"></i>
				     </Button>
				     </Col>
				 </Row>
			     </Card.Body>

			 </>
			}
                </Card>
            </Col>
	)
    }


    return (
	apiError ?
	    <Alert variant="danger">Error fetching data: {apiError}</Alert>
	    :


	<Tab.Container
            defaultActiveKey="roles"
            activeKey = {activeTab}
            className="mb-3"
            onSelect={setActiveTab}
        >
	    <Nav variant="pills" className="mb-3">
		<Nav.Item key="roles">
		    <Nav.Link eventKey="roles">Roles</Nav.Link>
		</Nav.Item>
		<Nav.Item key="assignment">
                    <Nav.Link eventKey="assignment">Auto Assignment</Nav.Link>
		</Nav.Item>
	    </Nav>
	    <Tab.Content id="admin-fns" className="p-0">
		<Tab.Pane eventKey="roles" key="roles">
		    <Card className="mb-4">
			<Card.Header as="h5" className="d-flex justify-content-between">
			    <Card.Title>Roles</Card.Title>
			    <Button size="sm" variant="primary" onClick={() =>setShowForm(true)}>Add Role</Button>
			</Card.Header>
			<Card.Body>
			    {isLoading ?
			     <div className="text-center">
				 <div className="lds-spinner"><div></div><div></div><div></div></div>
			     </div>
			     :
			     <Row>
				 <Col lg={6} sm={12} md={8}>
				     <Table striped>
					 <thead>
					     <tr>
						 <th>Role Name</th>
						 <th>Group</th>
						 <th>Users</th>
						 <th>Action</th>
					     </tr>
					 </thead>
					 <tbody>

					 {roles.map((r, index) => (
					     <tr key={`role-${index}`}>
						 <td>{r.role}</td>
						 <td><span className="d-flex align-items-center gap-2 mt-2 mb-2">
						     <DisplayLogo
							 name={r.group?.name}
							 photo={r.group?.photo}
							 color={r.group?.logocolor}

						     />
							 <span className="participant">
							     {r.group?.name}
							 </span>
						     </span>
						 </td>
						 <td>{r.users.length} users</td>
						 <td>

						     <span className="d-flex align-items-center gap-1">
							 <Button className="px-1" variant="btn-icon" onClick={(e)=>(setEditRole(r))}><i className="fas fa-pen" title="Edit role"></i></Button>
							 {r.users.length == 0 &&
							  <Button className="px-1" variant="btn-icon" onClick={(e)=>(setDisplayConfirmationModal(true), setRemoveID(r.id))}><i className="fas fa-trash" title="Remove Role"></i></Button>
							 }

						     </span>
							 
						 </td>
					     </tr>
					 ))}
					 </tbody>
				     </Table>
				 </Col>
			     </Row>
			    }

			</Card.Body>
		    </Card>
		    <DeleteConfirmation
                        showModal={displayConfirmationModal}
                        confirmModal={submitRemoveRole}
                        hideModal={hideConfirmationModal}
			id={removeID}
                        message={"Are you sure you want to remove this role?"}
		    />
		</Tab.Pane>
		<Tab.Pane eventKey="assignment" key="assignment">
		    <Card className="mb-4">
			<Card.Header as="h5"><Card.Title>Manage Role Auto Assignment</Card.Title></Card.Header>
			<Card.Body>
			    <p>Add users to each role.  Roles can be added on the <a href="#" onClick={(e)=>setActiveTab("roles")}>Role Tab</a>. Weight determines probability of user being assigned.</p>
			    {roles ?
			     <Row xs={1} md={2} className="g-4">
				{roles.map((r, index) => {
				    return (
					<RoleCard
					    key={r.id}
					    role = {r}
					/>
				    )

				})
				}
			     </Row>
			     :
			     <Alert variant="warning">No roles defined</Alert>
			    }
			</Card.Body>
		    </Card>
		    <AddRoleModal
			showModal={showForm}
			hideModal={hideFormModal}
			options={teams}
			editRole={editRole}
		    />
		</Tab.Pane>
	    </Tab.Content>
	</Tab.Container>

    )
}

export default AdminApp;
