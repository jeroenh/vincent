import React, { useState, useEffect, useCallback } from "react";
import { format, formatDistance } from "date-fns";
import { useParams, useNavigate, Link, useLocation } from "react-router";
import { Table, Card, Form, Button, Modal, Alert } from "react-bootstrap";
import AdminAPI from "./AdminAPI";
import DeleteConfirmation from "./DeleteConfirmation";
import DisplayLogo from "./DisplayLogo";


const adminapi = new AdminAPI();

const CSAFProfiles = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [profiles, setProfiles] = useState([])
    const [error, setError] = useState({'variant': '', 'msg': ''});
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);

    
    const hideForm = () => {

        setShowForm(false);
    }

    const saveProfile = (name) => {
	navigate("create", {state: {profile: name}});
        
    }

    const removeProfile = (profile) => {

	setDeleteMessage("Are you sure you want to remove this profile?");
	setRemoveID(profile);
    	setDisplayConfirmationModal(true);

    }


    const submitRemoveProfile = () => {
        adminapi.deleteCSAFProfile(removeID).then((response) => {
            setError({'msg':`Got it! Profile was successfully removed.`, 'variant': 'success'});
	    fetchInitialData();
        }).catch(err => {
            setError({'msg': `Error removing components: ${err.response.data.detail}`, 'variant': 'danger'});
        })
        setDisplayConfirmationModal(false);
    };

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    };

    const editProfile = (profile) => {

	navigate("edit", {state: {edit:profile, profile: profile.name}});
	

    }

    const cloneProfile = (profile) => {
	navigate("create", {state: {profile: `${profile.name}_clone`, clone: profile}});
    }
    

    const fetchInitialData = async () => {

	await adminapi.getCSAFProfiles().then((response) => {
	    console.log(response);
	    setProfiles(response);
	}).catch(err => {

	    console.log(err);
	});
	
    }

    useEffect(() => {
        fetchInitialData();
    }, []);
    
    const ProfileNameModal = (props) => {
        const [profileName, setProfileName] = useState("");
        const [invalidProfileName, setInvalidProfileName] = useState(false);

        const saveProfile = (event) => {
            event.preventDefault();

            if (profileName === "") {
                setInvalidProfileName(true);
                return;
            }

            props.save(profileName);
        };

        return (
            <Modal
                show={props.show}
                onHide={props.hide}
                centered
                backdrop="static"
            >
                <Modal.Header closeButton>
                    <Modal.Title>Name this CSAF Profile</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label className="mb-0">
                            Profile Name
                            <span className="required">*</span>
                        </Form.Label>
                        <Form.Text>Provide a name for this profile.</Form.Text>
                        <Form.Control
                            name="url"
                            isInvalid={invalidProfileName}
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                        />
                        {invalidProfileName && (
                            <Form.Text className="error">
                                This field is required.
                            </Form.Text>
                        )}
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        data-testid="cancel-confirm"
                        variant="secondary"
                        onClick={props.hide}
                    >
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={(e) => saveProfile(e)}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    };

    return (
        <>
        <Card className="mb-4">
            <Card.Header as="h5" className="d-flex justify-content-between">
                <Card.Title>CSAF Settings Profiles</Card.Title>
                <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowForm(true)}
                >
                    <i className="fas fa-plus"></i> Add Profile
                </Button>
            </Card.Header>
            <Card.Body>
		{error.msg &&
                 <Alert variant={error.variant}>{error.msg}</Alert>
                }   
		<Table>
		    <thead>
			<tr>
			    <th>
				Name
			    </th>
			    <th>Created By</th>
			    <th>Created Date</th>
			    <th>Actions</th>
			</tr>
		    </thead>
		    <tbody>
			{profiles.length == 0 &&

			 <tr className="text-center">
			     <td colSpan="4">No profiles to view.</td>
			 </tr>
			}
			{profiles.map((profile, index) => (
			    <tr key={`profile-${index}`}>
				<td>{profile.name}</td>
				<td><div className="d-flex align-items-center gap-2">
					<DisplayLogo
					name={profile.created_by.name}
					photo={profile.created_by.photo}
					color ={profile.created_by.logocolor}
					/>
					<div className="post_author ml-3">{profile.created_by.name }</div>
				    </div>
				</td>
				<td>{format(new Date(profile.created), 'yyyy-MM-dd')}</td>
				<td><Button variant="btn-icon px-1" title="Edit Profile" onClick={()=>editProfile(profile)}><i className="fas fa-edit"></i></Button>
				    <Button variant="btn-icon px-1" title="Clone Profile" onClick={()=>cloneProfile(profile)}><i className="fas fa-clone"></i></Button>
				<Button variant="btn-icon px-1" title="Remove Profile" onClick={()=>removeProfile(profile.id)}><i className="fas fa-trash"></i></Button></td>
			    </tr>
			))}
		    </tbody>
		</Table>

	    </Card.Body>
        </Card>

        <ProfileNameModal
        show = {showForm}
        hide = {hideForm}
        save = {saveProfile}
        />

	    <DeleteConfirmation
                showModal={displayConfirmationModal}
                confirmModal={submitRemoveProfile}
		hideModal={hideConfirmationModal}
                id={removeID}
                message={deleteMessage} />  
	    
        </>
    );
};

export default CSAFProfiles;
