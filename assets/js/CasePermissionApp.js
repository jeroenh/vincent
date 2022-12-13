import React, { useState, useEffect, useMemo } from 'react';
import {Row, Modal, Toast, Table, Alert, Card, Col, ListGroup, Button, Form, Dropdown, Tab, Nav, DropdownButton} from 'react-bootstrap';
import ContactAPI from './ContactAPI';
import DisplayStatus from './DisplayStatus';
import DisplayLogo from "./DisplayLogo";

const contactapi = new ContactAPI();

const CasePermissionApp = (props) => {


    const [isLoading, setIsLoading] = useState(true);
    const [apiError, setApiError] = useState(null);
    const [data, setData] = useState([]);
    const [selectUser, setSelectUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [casePerms, setCasePerms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showToast, setShowToast] = useState({
        show: false,
        msg: "",
        type: "",
    });


    function parseUsersData(r) {
	const cps = []
	users.forEach((item) => {
	    if (!item.group_admin) {
		let read = [];
		let rw = [];
		let no_access = [];
		r.forEach((c) => {
		    let keys = Object.keys(c.permissions);
		    if (keys.includes(item.contact.uuid)) {
			let p = c.permissions[item.contact.uuid];
			if (p === "r") {
			    read.push(c.case_id);
			} else if (p === "rw") {
			    rw.push(c.case_id);
			} 
		    } else {
			no_access.push(c.case_id);
		    }
		})
		cps.push({'user': item, 'r': read, 'rw': rw, 'no_access': no_access})
	    } else {
		cps.push({'user': item});
	    }
	});
	setCasePerms(cps);
    }

    
    const fetchInitialData = async () => {
        setApiError(null);
         await contactapi.getGroupCasePerms(props.group.uuid).then((response) => {
	     console.log(response)
             setData(response);
             setIsLoading(false);
         }).catch (err => {
            setIsLoading(false);
            setApiError(err);
	 })
    }


    useEffect(() => {

	if (data.length > 0) {
	    parseUsersData(data);
	}
    }, [data]);

    const showCases = (u) => {
	setSelectUser(u);
	setShowModal(true);

    }

    const saveChanges = async (e) => {
	if (event) event.preventDefault();

        const formData = new FormData(event.target),
              formDataObj = Object.fromEntries(formData.entries());
	const perms = [];
	/*only return cases that have perms */
	Object.keys(formDataObj).forEach(key => {
	    if (formDataObj[key] != "none") {
		perms.push({"case":key, perms:formDataObj[key]});
	    }})
	
	console.log(perms);
	console.log(formDataObj);

	const data = {'perms': perms, 'user': selectUser.contact.uuid}

	await contactapi.setGroupCasePerms(props.group.uuid, data).then((response) => {
	    setSelectUser(null);
	    setShowModal(false);
	    fetchInitialData();
	    setShowToast({
                show: true,
                msg: "Got it! Your changes have been saved!",
                type: "success",
            });

	}).catch(err => {
	    setApiError(err);
	})
    }

    useEffect(() => {

	if (props.contacts.length > 0) {
	    let u = props.contacts.filter(contact => contact.contact.user)
	    
	    setUsers(u);
	}
	
    }, [props.contacts])


    useEffect(() => {

	if (users.length > 0) {
	    fetchInitialData();
	}
    }, [users]);
	
    
    return (
	isLoading ?
            <Row>
                <Col lg="12">
                    <div className="text-center">
                        <div className="lds-spinner"><div></div><div></div><div></div></div>
                    </div>
                </Col>
            </Row>
	    :
	    <>
		<div className="float-end">
                    <Toast
                        bg={showToast.type}
                        onClose={() =>
                            setShowToast({ show: false, type: "success" })
                        }
                        show={showToast.show}
		    >
                        <Toast.Body>{showToast.msg}</Toast.Body>
                    </Toast>
                </div>
		{data.length > 0 ?
		<Table aria-label="User Case Permission Table">
		    <thead>
			<tr>
			    <th>User</th>
			    <th>Cases</th>
			</tr>
		    </thead>
		    <tbody>
			{casePerms.map((d, index) => (
			    <tr key={`u-${index}`}>
				<td>
				    <div className="d-flex align-items-center gap-2 mt-2 mb-2" key={`user-${index}`}>
					<DisplayLogo
					    photo = {d.user.contact.user.photo}
					    color = {d.user.contact.user.logocolor}
					    name= {d.user.contact.user.name}
					/>
					<span>
					    <a href={`${d.user.contact.url}`}>{d.user.contact.user.name}</a>
					</span>
				    </div>
				</td>
				<td>
				    {d.user.group_admin ?
				     `All`
				     :
				     <>
					 Read: {d.r.length}<br/>
					 Read/Write: {d.rw.length}<br/>
					 No Access: {d.no_access.length}<br/>
					 <a href="#" onClick={(e)=>(e.preventDefault(), showCases(d.user))}>View Cases</a>
				     </>
				    }
				</td>
			    </tr>
			))}
		    </tbody>
		</Table>
		 :
		 <div className="alert alert-warning">This group has not been notified of any cases.</div>
		}
		 
		{showModal &&
		<Modal show={showModal} onHide={(e)=>setShowModal(false)} backdrop="static" centered size="lg">
		    <Form onSubmit={(e)=>saveChanges(e)}>
		    <Modal.Header closeButton>
			<Modal.Title>
			    <div className="d-flex align-items-start gap-2">
				Set Case Permissions for
				<div className="d-flex align-items-start gap-2">
				    <DisplayLogo
					photo = {selectUser.contact.user.photo}
					color = {selectUser.contact.user.logocolor}
					name= {selectUser.contact.user.name}
				    /> <span> {selectUser.contact.user.name}</span>
				</div>
			    </div>
			    </Modal.Title>
		    </Modal.Header>
		    <Modal.Body>

			<Table>
			    <thead>
				<tr>
				    <th>
					Case
				    </th>
				    <th>
					Read
				    </th>
				    <th>
					Read/Write
				    </th>
				    <th>
					No Access
				    </th>
				</tr>
			    </thead>
			    <tbody>
				{data.map((d, index) => (
				    <tr key={`c-${index}`}>
					<td>
					    {d.case_identifier}: {d.title}{" "}
					    <DisplayStatus
						status= {d.status}
					    />
					</td>
					<td>
					    <Form.Check
						type="radio"
						value="r"
						name={d.case_id}
						defaultChecked={Object.keys(d.permissions).includes(selectUser.contact.uuid) && d.permissions[selectUser.contact.uuid] === "r"}
						title="Read Permissions"
					    />
					</td>
					<td>
					    <Form.Check
                                                type="radio"
                                                value="rw"
                                                name={d.case_id}
                                                defaultChecked={Object.keys(d.permissions).includes(selectUser.contact.uuid) && d.permissions[selectUser.contact.uuid] === "rw"}
						title="Read/Write Permissions"
                                            />
					</td>
					<td>
					    <Form.Check
                                                type="radio"
                                                value="none"
                                                name={d.case_id}
                                                defaultChecked={!(Object.keys(d.permissions).includes(selectUser.contact.uuid))}
                                                title="Deny Access"
                                            />
					</td>
				    </tr>
				))}
			    </tbody>
			</Table>
		    </Modal.Body>
		    <Modal.Footer>
			<Button data-testid="cancel-confirm" variant="secondary" onClick={(e)=>(event.preventDefault(), setShowModal(false))}>
			    Cancel
			</Button>
			<Button variant="primary" type="submit">
			    Save
			</Button>
		    </Modal.Footer>
		    </Form>
		</Modal>
		}
	    </>
    )

}

export default CasePermissionApp;
/*
  {d.case_identifier}: {d.title}{" "}
  <DisplayStatus
  status= {d.status}
  />
  </td>
  <td>
  {d.permissions.map((p, idx) => (
  <React.Fragment key={`p-${idx}`}>
  {p.user}
  </React.Fragment>
  ))}
  </td>
  <td>
  {d.permissions.map((p, idx) => (
  <React.Fragment key={`p-${idx}`}>
  {p.user}
  </React.Fragment>
  ))}

  </td>
*/
