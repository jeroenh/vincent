import React from 'react'
import { useState, useEffect, useRef} from 'react';
import { Modal,Tab, Tabs, Alert, Form, Button } from "react-bootstrap";
import axios from 'axios';
import ThreadAPI from './ThreadAPI';
import SSVCScore from './SSVCScore';
import CVSSv4App from './CVSS/CVSSv4App';
import CVSSApp from './CVSSApp';

const threadapi = new ThreadAPI();

const ScoreModal = ({ showModal, hideModal, vul }) => {

    const [showDeleteButton, setShowDeleteButton] = useState(true);
    const [accountID, setAccountID] = useState("");
    const [apiError, setApiError] = useState(false);
    const [activeTab, setActiveTab] = useState("ssvc");
    const [message, setMessage ] = useState([]);
    const [v3Score, setV3Score] = useState(null);
    const [v4Score, setV4Score] = useState(null);
    const [ssvcScore, setSSVCScore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [edit, setEdit] = useState(null);
    const [bulkEdit, setBulkEdit] = useState(false);
    const [saveMetrics, setSaveMetrics] = useState([]);
    const [removeScores, setRemoveScores] = useState([]);
    const [userInput, setUserInput] = useState(false);

    
    const v3ChildRef = useRef(null);
    const v4ChildRef = useRef(null);
    const ssvcRef = useRef(null);

    
    const submitCVSS = async (data, rmscores) => {
	/* change data to match serializer format */

	let newdata = {};
	let v3 = {};
	let v4 = {};

	data.forEach(v => {
            Object.keys(v).forEach(key => {
                if (key == "cvssV3_1") {
		    if (!rmscores.includes('cvss3')) {
			v3 = v[key];
		    }
		    
                } else if (key == "cvssV4_0") {
		    if (!rmscores.includes('cvss4')) {
			v4  = v[key];
		    }
                }
            });
        });
	
	if (Object.keys(v3).length > 0) {
	    v3 = {AV: v3['attackVector'][0],
		  AC: v3['attackComplexity'][0],
		  PR: v3['privilegesRequired'][0],
		  UI: v3['userInteraction'][0],
		  S: v3['scope'][0],
		  C: v3['confidentialityImpact'][0],
		  I: v3['integrityImpact'][0],
		  A: v3['availabilityImpact'][0],
		  vectorString: v3['vectorString'],
		  score: v3['baseScore'],
		  severity: v3['baseSeverity'],
		  version: v3['version'],
		  metrics_json: {cvssV3_1: v3}
		 }
	}
	if (Object.keys(v4).length > 0) {

	    v4 = {vectorString: v4['vectorString'],
		  score: v4['baseScore'],
		  severity: v4['baseSeverity'],
		  version: v4['version'],
		  metrics_json: {cvssV4_0: v4}
		 }
	}

	if (rmscores.includes('cvss3')) {
	    /* score was removed */
	    removeScore('3.1');
	}
	if (rmscores.includes('cvss4')) {
	    /* score was removed */
	    removeScore('4.0');
	    
	}
	
	
	if (bulkEdit) {
	    let axiosArray = [];
	    vul.forEach(vul => {
		if (Object.keys(v3).length) {
		    if (vul.original.cvss?.find(v => v.version.startsWith("3"))) {
			axiosArray.push(threadapi.updateCVSSScore(vul.original, v3));
		    } else {
			axiosArray.push(threadapi.addCVSSScore(vul.original, v3));
		    }
		}
		if (Object.keys(v4).length) {
		    if (vul.original.cvss?.find(v => v.version === "4.0")) {
		    axiosArray.push(threadapi.updateCVSSScore(vul.original, v4));
                    } else {
                        axiosArray.push(threadapi.addCVSSScore(vul.original, v4));
                    }
		}
	    });
	    try {
		await axios.all(axiosArray);
		hideModal();
	    } catch (err) {
		console.log(err);
		setError(`Error updating CVSS Score: ${err.message}`);
		}
	} else {
	    try {
		if (Object.keys(v3).length) {
		    if (v3Score) {
			threadapi.updateCVSSScore(vul, v3).then((response) => {
			});
		    } else {
			threadapi.addCVSSScore(vul, v3).then((response) => {
			})
		    }
		}
		if (Object.keys(v4).length) {
		    if (v4Score) {
			threadapi.updateCVSSScore(vul, v4).then((response) => {
			    hideModal();
			})
		    } else {
			threadapi.addCVSSScore(vul, v4).then((response) => {
			    hideModal();
			})
		    }
		}
	    } catch (err) {
		console.log(err);
		setError(`Error updating CVSS Score: ${err.message}`);
	    }

	}
    }

    const submitSSVCScore = async (data, rmscores) => {
	let ssvc = {};

	data.forEach(v => {
	    Object.keys(v).forEach(key => {
                if (key == "ssvc") {
		    if (!rmscores.includes("ssvc")) {
			ssvc = v[key];
		    }
                } 
            });
        });


	if (rmscores.includes("ssvc")) {
	    /* remove score */
	    removeSSVCScore();
	}
	
	if (Object.keys(ssvc).length == 0) {
	    /* ssvc not updated */
	    return;
	}

	if (bulkEdit) {
	    let axiosArray = [];
	    vul.forEach(v => {
		console.log("in bulkedit");
		console.log(v);
		if (v.original.ssvc_vector) {
		    axiosArray.push(threadapi.updateSSVCDecision(v.original, ssvc));
		} else {
		    axiosArray.push(threadapi.addSSVCDecision(v.original, ssvc));
		}
	    });
	    try {
		await axios.all(axiosArray);
		hideModal();
	    } catch(err) {
		setError(`Error udpating SSVC Score: ${err.message}`);
	    }
	} else {
	    
	    try {
		if (vul.ssvc_vector) {
                   await threadapi.updateSSVCDecision(vul, ssvc).then((response) => {
			hideModal();
                    });
		} else {
                   await threadapi.addSSVCDecision(vul, ssvc).then((response) => {
			hideModal();
	            });
		}
            } catch (err) {
		console.log(err);
		setError(`Error updating SSVC Score: ${err.message}`);
            }
	}
    }

    const removeSSVCScore = async () => {

	if (bulkEdit) {
	    let	axiosArray = [];
            vul.forEach(v => {
		axiosArray.push(threadapi.removeSSVCDecision(v.original));
	    });
	    try {
		await axios.all(axiosArray);
	    } catch(err) {
		setError(`Error removing SSVC Scores: ${err.message}`);
	    }
	} else {
            await threadapi.removeSSVCDecision(vul).then((response) => {
            }).catch(err => {
		console.log(err);
            });
	}
    }


    const removeScore = async (version) => {

	if (bulkEdit) {
            let axiosArray = [];
            vul.forEach(v => {
		axiosArray.push(threadapi.removeCVSSScore(v.original, version));
            });
            try	{
                await axios.all(axiosArray);
            } catch(err) {
		setError(`Error removing CVSS Scores: ${err.message}`);
            }
	} else {
	    try {
		threadapi.removeCVSSScore(vul, version).then((response) => {
                })
	    } catch (err) {
		setError("Error removing CVSS score.  Try again later.");
	    }
	}
    }

    const doBulkEdit = () => {

	let notempty = vul.find(x => x.original.cvss?.length > 0);
	if (notempty) {
	    let v3 = notempty.original.cvss.find(v => v.version.startsWith("3"));
            let v4 = notempty.original.cvss.find(v => v.version === "4.0");
            setV3Score(v3);
            setV4Score(v4);
	} else {
	    setV3Score(null);
	    setV4Score(null);
	}

	let ssvc = vul.find(x => x.original.ssvc_decision != null);
	if (ssvc) {
	    setSSVCScore(ssvc.original);
	} else {
	    setSSVCScore(vul[0].original);
	}
	
	setLoading(false);
	
    }

    // Async Fetch
    const fetchInitialData = async () => {

	if (Array.isArray(vul)) {
	    setBulkEdit(true);
	    doBulkEdit();
	    return;
	}

	if (vul.cvss?.length > 0) {
            await threadapi.getCVSSScore(vul).then((response) => {
		if (response) {
		    let v3 = response.find(v => v.version.startsWith("3"));
		    let v4 = response.find(v => v.version.startsWith("4"));
		    setV3Score(v3);
		    setV4Score(v4);
		}
                setLoading(false);
            }).catch(err => {
		if (err.response?.status == 404) {
		    /* no cvss score for this vul */
		    setV3Score(null);
		    setV4Score(null);
		} else if (err.response?.status == 403) {
		    setError(`You are not permitted to score this vulnerability.`);
		} else {
		    setError(`Error fetching CVSS score: ${err.message}`);
		    console.log('Error:', err)
		}
		setLoading(false);
	    });
        } else {
	    let v3 = vul.cvss.find(v => v.version.startsWith("3"));
            let v4 = vul.cvss.find(v => v.version.startsWith("4"));
            setV3Score(v3);
            setV4Score(v4);
	}
	    
    }

    useEffect(() => {

	setSSVCScore(vul);
        setV3Score(null);
        setV4Score(null);
        setBulkEdit(false);
	setRemoveScores([]);
	setActiveTab("ssvc");
	setSaveMetrics([]);
	
	if (vul) {
            fetchInitialData();
	}
    }, [vul]);


    const updateMetric = (score) => {
        let existing = [];

	
	if (score.version === "3.1") {
	    /* check if we need to overwrite an existing metric */
            existing = saveMetrics.filter(item => {
                let k = Object.keys(item).filter(objKey => objKey !== 'cvssV3_1')
                if (k.length > 0) {
                    return item;
                }
            });
            existing.push({'cvssV3_1': score});
            setSaveMetrics(existing);

        } else if (score.version == "4.0") {
            /* check if we need to overwrite an existing metric */
            existing = saveMetrics.filter(item => {
                let k = Object.keys(item).filter(objKey => objKey !== 'cvssV4_0')
                if (k.length > 0) {
                    return item;
                }
            });
            existing.push({'cvssV4_0': score});
            setSaveMetrics(existing);
        } else {
	    /* ssvc */
	    existing = saveMetrics.filter(item => {
		let k = Object.keys(item).filter(objKey => objKey !== "ssvc")
		if (k.length > 0) {
		    return item;
		}
	    });
	    existing.push({'ssvc': score});
	    setSaveMetrics(existing);
	}
					  
        return existing;

    }
    

    /* this function updates the metrics that each of the child components are producing.
       Between tab changes, scores are saved.
       Once the user hits the save button, the "hide" parameter will be true and submitCVSS
       and submitSSVCScore will be called with updated scores. Then the modal will close. */
    
    const saveScore = (score, hide=true) => {

	let newMetric = [];
	let scoresRemoved = removeScores;
        if (score) {
            newMetric = updateMetric(score);
	    if (removeScores.includes(activeTab)) {
		scoresRemoved = removeScores.map(x => x != activeTab);
		setRemoveScores(scoresRemoved);
	    }
	    
        } else {
	    /* remove score */
	    if (!removeScores.includes(activeTab)) {
		scoresRemoved.push(activeTab);
		setRemoveScores(scoresRemoved);
	    }
        }

        if (hide) {
            submitCVSS(newMetric, scoresRemoved);
	    submitSSVCScore(newMetric, scoresRemoved);
            hideModal();
        }
    }



    const handleClose = () => {
        if (userInput) {
            if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                setUserInput(false);
                hideModal();
            }
        } else {
            hideModal();
	}
    };


    
    
    const setActiveTabNow = (props) => {

        if (activeTab == "cvss3" && v3ChildRef.current) {
            /* force save */
            v3ChildRef.current.testSubmit(null, false);
        } else if (activeTab == "cvss4" && v4ChildRef.current) {
            v4ChildRef.current.testSubmit(null, false);
        } else {
	    ssvcRef.current.saveScore(false);
	}
        setActiveTab(props);
    }
    
    
    return (
        <Modal show={showModal} onHide={handleClose} size="xl" centered backdrop="static">
        <Modal.Header closeButton>
            <Modal.Title>Score the vulnerability</Modal.Title>
        </Modal.Header>
            <Modal.Body>
		{error &&
		 <div className="alert alert-danger">{error}</div>
		}
		{bulkEdit &&
		 <div className="alert alert-warning">You are scoring multiple vulnerabilities:{" "}
                 {vul.map((x, index)=> (<span key={`bulkedit-${index}`}>{x.original.vul}{" "}</span>))}</div>
                }
		<Tabs
		    defaultActiveKey="ssvc"
		    id="scoringtabs"
		    activeKey={activeTab}
		    onSelect={setActiveTabNow}
		    className="mb-3"
		    fill
		>
		    <Tab eventKey="ssvc" title="SSVC">
			<SSVCScore
			    vul={ssvcScore}
			    hideModal = {handleClose}
			    save = {saveScore}
			    remove = {removeSSVCScore}
			    ref = {ssvcRef}
			    attributes={vul?.attributes}
			    scoreChange={setUserInput}
			/>
		    </Tab>
		    <Tab eventKey="cvss4" title="CVSS V4">
                        <CVSSv4App
                            vul={vul}
                            hideModal = {handleClose}
                            saveScore = {saveScore}
			    metrics={v4Score}
			    ref={v4ChildRef}
			    userInput={setUserInput}
                        />
                    </Tab>
		    <Tab eventKey="cvss3" title="CVSS V3">
			<CVSSApp
			    hideModal = {handleClose}
			    saveScore = {saveScore}
			    metrics = {v3Score}
			    ref = {v3ChildRef}
			    userInput={setUserInput}
			/>
		    </Tab>
		</Tabs>

	    </Modal.Body>
	</Modal>
    )
}

export default ScoreModal;
