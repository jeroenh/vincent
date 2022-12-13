import React from 'react';
import { Modal,Alert, Button } from "react-bootstrap";
import ThreadAPI from './ThreadAPI';
import { format, formatDistance } from 'date-fns';
import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

const threadapi = new ThreadAPI();

const EditThreadsModal = (props) => {

    const [error, setError] = useState("");
    const [editThread, setEditThread] = useState("");
    const [tempThread, setTempThread] = useState("");
    const [threads, setThreads] = useState([]);
    const [updated, setUpdated] = useState([]);
    const [archived, setArchived] = useState([]);
    
    const editThreadNow = (thread, index) => {
	setTempThread(thread.subject);
	setEditThread(index);
    }

    const doneEditThread = (file, index) => {
	setThreads(old =>
	    old.map((row, idx) => {
		if (index == idx) {
		    let r;
		    if (archived.includes(row.id)) {
			r = {
			    ...old[index],
			    subject: tempThread,
			    archived: true
			}
		    } else {
			r = {
			    ...old[index],
			    subject: tempThread,
			    archived: false
			}
		    }
		    return r;
		}
		return row
	    })
	);
	setEditThread("");
	setTempThread("");
	setUpdated([...updated, file.id]);

    }

    const cancelEdit = () => {
	setEditThread("");
	setTempThread("");
    }

    const saveFiles = async () => {
	let axiosArray = [];

	updated.forEach(id => {
	    let thread = threads.find(x => x.id == id);
	    axiosArray.push(threadapi.updateThread(thread.id, {subject: thread.subject, archived: thread.archived}));
	});

	try {
            await axios.all(axiosArray);
	    props.save(threads);
            props.hideModal();
        } catch (err) {
            console.log(err);
            setError(`Error updating thread settings: ${err.message}`);
	}
    }


    const archiveThread = (id) => {
	if (archived.includes(id)) {
	    let newt = archived.filter(x => x != id);
	    setArchived(newt);
	} else {
	    setArchived([...archived, id]);
	}
    }

	
    
    useEffect(() => {
	setThreads(props.threads);
	let arc = props.threads.filter(x => x.archived);
	let arc_id = arc.map(x => x.id);
	setArchived(arc_id);
	
    }, [props.threads]);


    return (

	<Modal show={props.showModal} onHide={props.hideModal} size="xl" centered backdrop="static">
            <Modal.Header closeButton className="border-bottom">
		<Modal.Title>Case Thread Settings</Modal.Title>
            </Modal.Header>
	    <Modal.Body>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		}
		<table className="table striped w-100">
		    <thead>
			<tr><th className="w-50">Thread Subject</th>
			    <th>Created Date</th>
			    <th>Last Post Date</th>
			    <th>Archived</th>
			</tr>
		    </thead>
		    <tbody>
		    {threads.map((thread, index) => (
			<tr key={`thread-${index}`}>
			    {editThread === index ?
			     <>
				 <td className="w-50">
				     <input type="text" className="form-control" value={tempThread} onChange={(e) => setTempThread(e.target.value)}/>
				 </td>
				 <td>
                                     {format(new Date(thread.created), 'yyyy-MM-dd')}
                                 </td>
				 <td>
                                     {format(new Date(thread.last_post), 'yyyy-MM-dd')}
                                 </td>
				 <td>
				     <button onClick={(e)=>archiveThread(thread.id)} className="btn btn-xs btn-primary">{archived.includes(thread.id) ? 'Un-Archive' : 'Archive'}</button>
                                 </td>


				 <td>
				 <div className="d-flex align-items-center gap-1">
				     <button className="btn btn-icon" title="Finish edit" onClick={(e)=>doneEditThread(thread, index)}>
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
				     {format(new Date(thread.created), 'yyyy-MM-dd')}  
				 </td>
				 <td>
				     {format(new Date(thread.last_post), 'yyyy-MM-dd')}            
				 </td>
				 <td>
				     {thread.archived ?
				      "ARCHIVED"
				      :
				      "ACTIVE"
				     }
				 </td>
				 {thread.official ?
				  <td></td>
				  
				  :
				 <td>
				     <button className="btn btn-icon" title="Edit thread title" onClick={(e)=>editThreadNow(thread, index)}>
					 <i className="fas fa-pen"></i>
				     </button>
				 </td>
				 }
			     </>
				 }
			</tr>
		    ))}
		    </tbody>
		 </table>
	    </Modal.Body>
	    <Modal.Footer>
                <Button variant="outline-secondary" data-testid="cancel-editsettings" type="cancel" onClick={(e)=>(e.preventDefault(), props.hideModal())}>Cancel</Button>
                <Button type="submit" disabled={editThread !== ""} onClick={(e)=>saveFiles()} variant="primary">Save</Button>
                </Modal.Footer>
	</Modal>
    )


}


export default EditThreadsModal;
