import React from 'react'
import { useState, useEffect, useRef } from 'react';
import { Modal, Tabs, Tab} from "react-bootstrap";
import CVSSApp from './CVSSApp';
import CVSSv4App from './CVSS/CVSSv4App';

const CVSSModalApp = (props) => {

    const [activeTab, setActiveTab] = useState("cvss3");
    const [v3Score, setV3Score] = useState(null);
    const [v4Score, setV4Score] = useState(null);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState([]);
    
    const v3ChildRef = useRef(null);
    const v4ChildRef = useRef(null);
    
     useEffect(() => {
	 setLoading(true);
         setV3Score(null);
         setV4Score(null);

	 setMetrics(props.metrics);
	 console.log(props.metrics);
         if (props.metrics.length > 0) {
	     props.metrics.forEach(v => {
		 Object.keys(v).forEach(key => {
		     if (key == "cvssV3_1") {
			 setV3Score(v[key]);
		     } else if (key == "cvssV4_0") {
			 setV4Score(v[key]);
		     }
		 });
	     });
	 }

	 setLoading(false);
     }, [props.showModal]);


    const updateMetric = (cvss) => {

	let existing = [];
	
        if (cvss.version === "3.1") {
            /* check if we need to overwrite an existing metric */
            existing = metrics.filter(item => {
                let k = Object.keys(item).filter(objKey => objKey !== 'cvssV3_1')
                if (k.length > 0) {
                    return item;
                }
            });
            existing.push({'cvssV3_1': cvss});
            setMetrics(existing);
        } else {
            /* check if we need to overwrite an existing metric */
            existing = metrics.filter(item => {
                let k = Object.keys(item).filter(objKey => objKey !== 'cvssV4_0')
                if (k.length > 0) {
                    return item;
                }
            });
            existing.push({'cvssV4_0': cvss});
            setMetrics(existing);
        }

	return existing;
    }
    

    const saveScore = (cvss, hide=true) => {
	let newMetric = [];
	if (cvss) {
	    newMetric = updateMetric(cvss);
	} else {
	    /* remove score */
	    if (activeTab == "cvss3") {
		newMetric = metrics.filter(item => {
		    let k = Object.keys(item).filter(objKey => objKey !== 'cvssV3_1')
                    if (k.length > 0) {
			return item;
                    }
		});
	    } else {
		newMetric = metrics.filter(item => {
		    let k = Object.keys(item).filter(objKey => objKey !== 'cvssV4_0')
                    if (k.length > 0) {
			return item;
                    }
		});
	    }
	}

	if (hide) {
	    console.log(newMetric);
	    console.log("saving");
	    props.saveScore(newMetric);
	    props.hideModal();
	}
    }

    const setActiveTabNow = (props) => {
	console.log("setactivetab!!");
	console.log(v3ChildRef);
	
	if (activeTab == "cvss3" && v3ChildRef.current) {
	    /* force save */
	    v3ChildRef.current.testSubmit(null, false);
	} else if (v4ChildRef.current) {
	    v4ChildRef.current.testSubmit(null, false);
	}
	setActiveTab(props);
    }
    


    
    return (

	<Modal show={props.showModal} onHide={props.hideModal} size="xl" centered backdrop="static" className="cvssmodal">
            <Modal.Header closeButton>
		<Modal.Title>Score the vulnerability</Modal.Title>
            </Modal.Header>
	    <Modal.Body>
		{loading ?
		 <div className="text-center">                                                        
                     <div className="lds-spinner">                                                    
                         <div></div>                                                                  
                         <div></div>                                                                  
                         <div></div>                                                                  
                     </div>                                                                           
                 </div>     

		 :
		 
		 <Tabs
                     defaultActiveKey="ssvc"
                     id="scoringtabs"
                     activeKey={activeTab}
                     onSelect={setActiveTabNow}
                     className="mb-3"
                     fill
		 >
		     <Tab eventKey="cvss3" title="CVSS V3">     
			 <CVSSApp
			     hideModal={props.hideModal}
			     saveScore={saveScore}
			     metrics={v3Score}
			     ref = {v3ChildRef}

			 />
		     </Tab>
		     <Tab eventKey="cvss4" title="CVSS V4">                                                           
                         <CVSSv4App
                             hideModal={props.hideModal}
                             saveScore = {saveScore}
                             metrics={v4Score}
			     ref = {v4ChildRef}
                         />
		     </Tab>
		 </Tabs>
		}
	    </Modal.Body>
	</Modal>

    )
}


export default CVSSModalApp;
