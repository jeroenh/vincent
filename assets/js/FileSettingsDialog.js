import React from 'react';
import { Modal,Alert, Button } from "react-bootstrap";
import ThreadAPI from './ThreadAPI';
import { format, formatDistance } from 'date-fns';
import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

const threadapi = new ThreadAPI();

const FileSettingsDialog = (props) => {

    const [error, setError] = useState("");
    const [editFile, setEditFile] = useState("");
    const [tempFile, setTempFile] = useState("");
    const [files, setFiles] = useState([]);
    const [updated, setUpdated] = useState([]);

    const editFileNow = (file, index) => {

	setTempFile(file.filename);
	setEditFile(index);

    }

    const doneEditFile = (file, index) => {
	setFiles(old =>
	    old.map((row, idx) => {
		if (index == idx) {
		    let r = {
			...old[index],
			filename: tempFile
		    }
		    return r;
		}
		return row
	    })
	);
	setEditFile("");
	setTempFile("");
	setUpdated([...updated, file.id]);

    }

    const cancelEdit = () => {
	setEditFile("");
	setTempFile("");
    }

    const saveFiles = async () => {
	let axiosArray = [];

	updated.forEach(id => {
	    let file = files.find(x => x.id == id);
	    axiosArray.push(threadapi.updateArtifact(file, {filename: file.filename}));
	});

	try {
            await axios.all(axiosArray);
	    props.save(files);
            props.hideModal();
        } catch (err) {
            console.log(err);
            setError(`Error updating file names: ${err.message}`);
	}
    }


    useEffect(() => {
	setFiles(props.files);
    }, [props.files]);


    return (

	<Modal show={props.showModal} onHide={props.hideModal} size="xl" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
		<Modal.Title>Case Artifacts Settings</Modal.Title>
            </Modal.Header>
	    <Modal.Body>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}
		<table className="table striped w-100">
		    <thead>
			<tr><th className="w-50">Artifact Name</th>
			    <th>Extension</th>
			    <th>Uploaded By</th>
			    <th>Uploaded Date</th>
			</tr>
		    </thead>
		    <tbody>
		    {files.map((file, index) => (
			<tr key={`thread-${index}`}>
			    {editFile === index ?
			     <>
				 <td className="w-50">
				     <input type="text" className="form-control" value={tempFile} onChange={(e) => setTempFile(e.target.value)}/>
				 </td>
				 <td>
                                    {file.mime_type}
                                 </td>
                                 <td>
                                     {file.user}
                                 </td>
                                 <td>
                                     {format(new Date(file.uploaded_date), 'yyyy-MM-dd')}
                                 </td>

				 <td>
				 <div className="d-flex align-items-center gap-1">
				     <button className="btn btn-icon" title="Finish edit" onClick={(e)=>doneEditFile(file, index)}>
					 <i className="fas fa-check"></i>
				     </button>
				     <button className="btn btn-icon" title="Cancel edit" onClick={(e)=>cancelEdit(file, index)}>
					 <i className="fas fa-times"></i>
				     </button>
				 </div>
				 </td>
			     </>
			     :
			     <>
				 <td className="w-50">
				 <span id="title">
				     {file.filename}
				 </span>
				 </td>
				 <td>
				     {file.mime_type}
				 </td>
				 <td>
				     {file.user}
				 </td>
				 <td>
				     {format(new Date(file.uploaded_date), 'yyyy-MM-dd')}
				 </td>
				 <td>
				     <button className="btn btn-icon" title="Edit thread title" onClick={(e)=>editFileNow(file, index)}>
					 <i className="fas fa-pen"></i>
				     </button>
				 </td>
			     </>
				 }
			</tr>
		    ))}
		    </tbody>
		 </table>
	    </Modal.Body>
	    <Modal.Footer>
                <Button variant="outline-secondary" data-testid="cancel-editsettings" type="cancel" onClick={(e)=>(e.preventDefault(), props.hideModal())}>Cancel</Button>
                <Button type="submit" disabled={editFile !== ""} onClick={(e)=>saveFiles()} variant="primary">Save</Button>
                </Modal.Footer>
	</Modal>
    )


}


export default FileSettingsDialog;
