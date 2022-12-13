import React from 'react';
import { Modal,Alert, Button } from "react-bootstrap";
import ThreadAPI from './ThreadAPI';
import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

const threadapi = new ThreadAPI();

const CaseThreadSettings = (props) => {

    const [error, setError] = useState("");
    const [editTitle, setEditTitle] = useState("");
    const [tempThread, setTempThread] = useState("");
    const [threads, setThreads] = useState([]);
    const [updated, setUpdated] = useState([]);
    
    const editThreadSubject = (thread, index) => {

	setTempThread(thread.subject);
	setEditTitle(index);

    }

    const doneEditSubject = (thread, index) => {
	setThreads(old =>
	    old.map((row, idx) => {
		if (index == idx) {
		    let r = {
			...old[index],
			subject: tempThread
		    }
		    return r;
		}
		return row
	    })
	);
	setEditTitle("");
	setTempThread("");
	setUpdated([...updated, thread.id]);

    }

    const cancelEdit = () => {
	setEditTitle("");
	setTempThread("");
    }

    const saveTitles = async () => {
	let axiosArray = [];
	updated.forEach(id => {
	    let thread = threads.find(x => x.id == id);
	    axiosArray.push(threadapi.updateThread(id, {subject: thread.subject}));
	});
	try {
            await axios.all(axiosArray);
	    props.save(threads);
            props.hideModal();
        } catch (err) {
            console.log(err);
            setError(`Error updating thread titles: ${err.message}`);
	}
    }
    

    useEffect(() => {
	setThreads(props.threads);
	console.log(props.threads);
    }, [props.threads]);


    return (

	<Modal show={props.showModal} onHide={props.hideModal} centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
		<Modal.Title>Case Thread Settings</Modal.Title>
            </Modal.Header>
	    <Modal.Body>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}
		<table className="table striped w-100">
		    <thead>
			<tr><th className="w-50">Thread Title</th><th></th></tr>
		    </thead>
		    <tbody>
		    {threads.map((thread, index) => (
			<tr key={`thread-${index}`}>
			    {editTitle === index ?
			     <>
				 <td className="w-50">
				     <input type="text" className="form-control" value={tempThread} onChange={(e) => setTempThread(e.target.value)}/>
				 </td>
				 <td>
				 <div className="d-flex align-items-center gap-1">
				     <button className="btn btn-icon" title="Finish edit" onClick={(e)=>doneEditSubject(thread, index)}>
					 <i className="fas fa-check"></i>
				     </button>
				     <button className="btn btn-icon" title="Cancel edit" onClick={(e)=>cancelEdit(thread, index)}>
					 <i className="fas fa-times"></i>
				     </button>
				 </div>
				 </td>
			     </>
			     :
			     <>
				 <td className="w-50">
				 <span id="title">
				     {thread.subject}
				 </span>
				 </td>
				 <td>
				     {!thread.official ?
				      <button className="btn btn-icon" title="Edit thread title" onClick={(e)=>editThreadSubject(thread, index)}>
					  <i className="fas fa-pen"></i>
				      </button>
				      :
				      <i className="fas fa-lock px-2" title="You are not permitted to change the name of this thread."></i>
				     }
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
                <Button type="submit" disabled={editTitle !== ""} onClick={(e)=>saveTitles()} variant="primary">Save</Button>
                </Modal.Footer>
	</Modal>
    )


}


export default CaseThreadSettings;
