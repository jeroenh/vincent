import React, { useState, useEffect } from 'react'
import {Card, Alert, NavDropdown, DropdownButton, Dropdown, InputGroup, FloatingLabel, Form, Container, Row, Col, Badge, Button} from 'react-bootstrap';
import { format, formatDistance } from 'date-fns'
import CaseThreadAPI from './ThreadAPI';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css'
import '../css/casethread.css';
import DisplayStatus from './DisplayStatus';
import DisplayLogo from './DisplayLogo';
import {Typeahead} from 'react-bootstrap-typeahead';
import UploadFileModal from './UploadFileModal';
import DisplayFilePreview from './DisplayFilePreview';
import DeleteConfirmation from "./DeleteConfirmation";
import ErrorModal from "./ErrorModal";
import FileSettingsDialog from './FileSettingsDialog';

const threadapi = new CaseThreadAPI();

const CaseArtifactApp = (props) => {

    const [caseInfo, setCaseInfo] = useState(null);
    const [reqUser, setReqUser] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [artifacts, setArtifacts] = useState([]);
    const [showRemove, setShowRemove] = useState(false);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);
    const [showShare, setShowShare] = useState(false);
    const [error, setError] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [displayErrorModal, setDisplayErrorModal] = useState(false);
    const [openFileSettings, setOpenFileSettings] = useState(false);

    const hideErrorModal = () => {
        setDisplayErrorModal(false);
    }
    
    const hideUploadModal = () => {
        setShowUploadModal(false);
    };

    const saveFileSettings = (updated) => {
        setArtifacts(updated);
    }

    
    const submitFile = async (data) => {
	await threadapi.addArtifact(caseInfo, data).then((response) => {
	    setArtifacts(artifacts => [...artifacts, response])
        }).catch(err => {
	    if (err.response.status == 403) {
		
		setErrorMessage(`Unable to upload file: You do not have adequate permissions to add an artifact. Please talk to your group administrator.`);
	    } else {
		setErrorMessage(`Unable to upload file: ${err.message}`);
	    }
	    setDisplayErrorModal(true);
	});
	hideUploadModal();
    }
    
    useEffect(() => {
        setCaseInfo(props.caseInfo);
	setReqUser(props.user);
    }, [props]);


    const getArtifacts = async () => {
        try {
            await threadapi.getArtifacts(caseInfo).then((response) => {
                setArtifacts(response);
		if (response.length == 0) {
		    setShowRemove(false);
		}
            })
        } catch (err) {
            console.log('Error:', err)
        }
    }

    function confirmRemoveFile(file) {
	setRemoveID(file.uuid);
	setDisplayConfirmationModal(true);
	setDeleteMessage(`Are you sure you want to remove this file \"${file.filename}\"?`);
    }
    
    useEffect(() => {
	if (caseInfo) {
	    getArtifacts();
	}
    }, [caseInfo]);

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }

    const submitRemoveFile = (id) => {
        threadapi.removeArtifact(id).then((response) => {
	    getArtifacts();
        })
        setDisplayConfirmationModal(false);
    }

    const shareFile = async (file) => {
	
	await threadapi.shareCaseArtifact(file).then(response => {
	    getArtifacts();
	    setShowShare(false);
	}).catch(err => {
	    setError(`Error changing artifact permissions: ${err.message}`);
	});
    };
    
    return (
        caseInfo ?
	    <Card className="pt-2">
		<Card.Header as="h5" className="d-flex align-items-center justify-content-between">
		    <Card.Title className="m-0">Case Files</Card.Title>
		    {reqUser.role !== "observer" &&
		    <DropdownButton variant="btn p-0"
                                    title={<i className="bx bx-dots-vertical-rounded" title="Manage Artifacts"></i>}
                    >
                        <Dropdown.Item eventKey='edit' onClick={(e)=>setShowUploadModal(true)}>Add File</Dropdown.Item>
			{reqUser.role === "owner" && artifacts.length > 0 &&
			 <>
			     <Dropdown.Item eventKey='share' onClick={(e)=>setShowShare(true)}>Share Settings</Dropdown.Item>
			     <Dropdown.Item eventKey='meta' onClick={(e)=>setOpenFileSettings(true)}>File Settings</Dropdown.Item>
			 </>
			 
			}
			{artifacts.length > 0 &&
			 <Dropdown.Item eventKey='remove' onClick={(e)=>setShowRemove(true)}>Remove Files</Dropdown.Item>
			}
                    </DropdownButton>
		    }
		</Card.Header>
		<Card.Body>
                     <ErrorModal
                         showModal = {displayErrorModal}
                         hideModal = {hideErrorModal}
                         message = {errorMessage}
                     /> 
		    <>
			{error &&
			 <Alert variant="danger">{error}</Alert>
			}
		    </>

		    <>
			{showRemove && 
			 <div className="d-grid mb-3"><Button variant="danger" size="sm" onClick={(e)=>setShowRemove(false)}>Cancel Remove Files</Button></div>
			}
		    </>
		    <PerfectScrollbar className="participant-list">
			    {artifacts.map((a, index) => {
				return (
				    <DisplayFilePreview
					key={`artifact-${index}`}
					file={a}
					remove = {showRemove}
					share = {showShare}
					removeFile = {confirmRemoveFile}
					shareFile = {shareFile}
					role={reqUser.role}
				    />
				)
			    })
			    }
		    </PerfectScrollbar>
		</Card.Body>
		<UploadFileModal
		    showModal = {showUploadModal}
		    hideModal = {hideUploadModal}
		    confirmModal = {submitFile}
		/>
		<DeleteConfirmation
                    showModal={displayConfirmationModal}
                    confirmModal={submitRemoveFile}
                    hideModal={hideConfirmationModal}
                    id={removeID}
                    message={deleteMessage} />

		{reqUser.role == "owner" &&
		 <FileSettingsDialog
		     showModal={openFileSettings}
		     hideModal={setOpenFileSettings}
		     files={artifacts}
		     save={saveFileSettings}
		 />
		}
		
	    </Card>
	:<></>
    )
}

export default CaseArtifactApp;
