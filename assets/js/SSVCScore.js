import React from 'react';
import { Modal, OverlayTrigger, Popover, Alert, Badge, FloatingLabel, Button, InputGroup, Form, Row, Col } from "react-bootstrap";
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import ThreadAPI from './ThreadAPI';
import decision_tree from "./CISA-Coordinator-v2.0.3.json";
import vulnrichment_decision_tree from "./Vulnrichment-v1.0.0.json";
import AssignmentDropdownButton from './AssignmentDropdownButton';
import DeleteConfirmation from 'Components/DeleteConfirmation';

const threadapi = new ThreadAPI();

const DECISION_TREE_CHOICES=[
    {"decision_tree": decision_tree,
     "file": "CISA-Coordinator-v2.0.3"
    },
    {"decision_tree": vulnrichment_decision_tree,
     "file":"Vulnrichment-v1.0.0"
    }
];

/* TODO: pick tree from drop down */
const decisionTreeName = "CISA-Coordinator-v2.0.3";

const SSVCScore = forwardRef((props, ref) => {

    const [error, setError] = useState(null);
    const [data, setData] = useState([]);
    const [decisionTree, setDecisionTree] = useState(decisionTreeName);
    const [children, setChildren ] = useState("");
    const [decisionPoint, setDecisionPoint] = useState(0);
    const [decisions, setDecisions] = useState([]);
    const [finalDecision, setFinalDecision] = useState("");
    const [decisionColor, setDecisionColor] = useState("success");
    const [vector, setVector] = useState("");
    const [shortKeys, setShortKeys] = useState([]);
    const [disabledButton, setDisabledButton] = useState(false);
    const [doUpdate, setDoUpdate] = useState(false);
    const [showNotes, setShowNotes] = useState([]);
    const [justifications, setJustifications] = useState({})
    const [invalidDecisions, setInvalidDecisions] = useState([]);
    const [formLocked, setFormLocked] = useState(false);
    const [userInput, setUserInput] = useState(false);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [showGutMismatch, setShowGutMismatch] = useState(false);
    const justRef = useRef([]);
    const mismatchRef = useRef(null);
    
    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }
    
    useEffect(() => {

	switch(finalDecision) {
	case "Act":
	case "Enrich":
	    setDecisionColor("danger");
	    break;
	case "Attend":
	    setDecisionColor("warning");
	    break;
	case "Track*":
	    setDecisionColor("info");
	    break;
	case "Track":
	case "Don't Enrich":
	    setDecisionColor("success");
	    break;
	default:
	    setDecisionColor("danger");
	}



    }, [finalDecision]);

    const toggleFormLock = () => {
	if (formLocked) {
	    setFormLocked(false);
	    if ('scoreChange' in props) {
		props.scoreChange(true);
	    }
	} else {
	    setFormLocked(true);
	}
    }


    const showMismatch = () => {
	if (showGutMismatch) {
	    setShowGutMismatch(false);
	} else {
	    setShowGutMismatch(true);
	}
    }
	
    
    const validate_dec_tree = (tree) => {
	/* this validates there isn't totally bogus values for each decision. If we can't validate
	   the decisions with the provided tree, then we will alert the user and refused to generate
	   the vector/final decision until values are validated */
	let this_is_valid = true;
	data.decision_points.map((d, index) => {
	    let decision = tree.filter((item) => item.label.localeCompare(d.label, undefined, {sensitivitiy:'base'}) == 0);
	    if (decision.length > 0) {
		let valid = d.options.filter((item) => item.label.localeCompare(decision[0]['value'], undefined, {sensitivity: 'base'}) == 0)
		if (valid.length == 0) {
		    if (d.label != 'Decision') {
			setInvalidDecisions(invalidDecisions => [...invalidDecisions, d.label])
			this_is_valid = false;
		    }

		}
	    } else {
		if (d.label != 'Decision') {
		    setInvalidDecisions(invalidDecisions => [...invalidDecisions, d.label])
		    this_is_valid = false;
		}
	    }
	});
	if (this_is_valid) {
	    setInvalidDecisions([]);
	}
	return this_is_valid;
    }
    
    const load_ssvc = () => {
	let xkeys = {};
	let short_keys = {};
	let isparent = {};
	let ischild = {};

	ischild = data.decision_points.reduce((x,y) => {
	    /* Use either key or label to create a hash of everyone */
	    xkeys[y.label] = y;
	    if("key" in y) {
		xkeys[y.key] = y.label
		short_keys[y.label] = y.key
	    }
	    /* Use either key or label to mark the xkeys to a child
	       decision tree */
	    if ("options" in y) {
		y.options.forEach(z => {
		    if ("key" in z) {
			short_keys[z.label] = z.key
		    }
		})
	    }

	    if("children" in y) {
		isparent[y.label] = [];
		y.children.map(z => {
		    var tx = z.label;
		    if(("key" in z) && (z.key != "")) {
			tx = xkeys[z.key];
		    }
		    isparent[y.label].push(xkeys[tx]);
		    x[tx] = 1;
		});
	    }

	    return x;
	},{});

	setShortKeys(short_keys);
	setChildren(ischild);

	/* if we already have a score!!! */
	if (props.vul && props.vul.ssvc_decision) {

	    let dec_tree = props.vul.ssvc_decision_tree.filter(item => !["date_scored", "tree_type"].includes(item.label));
	    let tree_type = "";
	    if (props.vul.tree_type) {
		tree_type = props.vul.tree_type;
	    } else {
		tree_type = props.vul.ssvc_decision_tree.find(item => item.label == "tree_type")
		if (tree_type) {
		    tree_type = tree_type.value;
		}
	    }
	    
	    if (tree_type === decisionTree) {
		if (validate_dec_tree(dec_tree)) {
		    if (props.vul.ssvc_vector) {
			setVector(props.vul.ssvc_vector);
		    }
		    setFinalDecision(props.vul.ssvc_decision);
		    setFormLocked(true);
		    setDecisions(dec_tree);
		    setDecisionPoint(data.decision_points.length-1);
		    if (props.vul.ssvc_justifications) {
			setJustifications(props.vul.ssvc_justifications);
			if ('assessment_mismatch' in props.vul.ssvc_justifications) {
			    setShowGutMismatch(true);
			}
		    }
		    return;
		}
	    }
	}
	    
	if (props.attributes?.length > 0) {
	    /* can we load from vul attributes */
	    const dec_tree = [];
	    data.decision_points.forEach((point) => {
		/* find decision point with matching label */
		let dec_point = props.attributes.find(attr => attr.name === point.label);
		if (dec_point){
		    /* check if value is valid */
		    let v = point.options?.find(opt => opt.label === dec_point['value']);
		    if (v) {
			dec_tree.push({'label': dec_point.name, 'value': dec_point.value});
		    }
		}
	    })
	    console.log(dec_tree);
	    /* does final decision for this tree exist? */
	    let final_decision = props.attributes.find(x => x.name === decisionTree);
	    if (final_decision) {
		setFinalDecision(final_decision.value);
	    }
	    setDecisionPoint(data.decision_points.length - 1);
	    setDecisions(dec_tree);
	    return;
	}
	
	if (props.preScore) {
	    const dec_tree = [];
	    data.decision_points.forEach((point) => {
		if ('options' in point) {
		    dec_tree.push({'label': point.label, 'value': point.options[0].label})
		    if (point.label == "Decision") {
			setFinalDecision(point.options[0].label);
		    }
		}
	    })
	    setDecisionPoint(data.decision_points.length-1);
	    setDecisions(dec_tree);
	}

    }

    const fetchInitialData = async () => {
	let load_existing = false;
	/* load tree */
	try {
	    if (props.vul && props.vul.ssvc_decision) {
		/* do we have this tree type */
		if (props.vul.tree_type || props.vul.ssvc_decision_tree.some(item => item.label == "tree_type")) {
		    let tree_type = ""
		    if (props.vul.tree_type) {
			tree_type = props.vul.tree_type;
		    } else {
			tree_type = props.vul.ssvc_decision_tree.find(item => item.label == "tree_type").value;
		    }
		    console.log(tree_type);
		    if (DECISION_TREE_CHOICES.some(x => x.file === tree_type)) {
			setDecisionTree(tree_type);
			load_existing = true;
		    }
		}	
	    }
	    if (!load_existing) {
		/* load default */
		setDecisionTree(decisionTreeName);
	    }

	} catch (err) {
	    console.log(err.message);
	    console.log("Failed to Load CISA tree.  Loading default tree");

	}

    }

    useEffect(() => {
	setUserInput(false);
	
	if (data.decision_points) {
	    load_ssvc(data);
	}
    }, [data])


    useEffect(() => {
	
	fetchInitialData();
    }, [props.vul]);

    useEffect(() => {
	
	console.log(decisionTree);
	if (decisionTree) {
	    setFormLocked(false);
	    let x = DECISION_TREE_CHOICES.filter((item) => item.file==decisionTree)	    
	    if (x.length > 0) {
		setData(x[0].decision_tree);
	    }
	}

    }, [decisionTree]);

    function update_decision(label, value) {
	let found = false;
	let updated_decisions = decisions.map(d => {
	    if (d.label == label) {
		found=true;
		return {'label': d.label, 'value': value};
	    } else {
		return d
	    }
	});
	if (found == false) {
	    /* add this decision */
            setDecisions(decisions => [...decisions, {'label': label, 'value': value}])
	} else {
	    setDecisions(updated_decisions);
	}
	if (invalidDecisions.includes(label)) {
	    const newList = invalidDecisions.filter((item) => item != label);
	    setInvalidDecisions(newList);
	}
	    
	
    }

    const get_combo_decision = (child_decisions) => {

	let deduce = {};
	child_decisions.forEach((x) => {
	    deduce[x.label] = x.value;
	});

	let parent_name = "";
	data.decision_points.forEach((point) => {
	    if ('children' in point) {
		parent_name = point.label;
		/* this is the complex decision */
		point.options.forEach((option) => {
		    option.child_combinations.forEach((child) => {
			let reset = [];
			child.forEach((r) => {
			    if (r.child_option_labels.includes(deduce[r.child_label])) {
				reset.push(option.label);
			    }
			})
			if (reset.length == Object.keys(deduce).length) {
			    /* we found the answer */
			    console.log("WE GOT THE ANSWER. Add to Decision");
			    console.log(reset);
			    if (decisions.some((x) => x.label == parent_name)) {
				/* this is an update */
				console.log("UPDATE THE DECISION!!!");
				update_decision(parent_name, reset[0]);
			    } else {
				setDecisions(decisions => [...decisions, {'label': parent_name, 'value': reset[0]}])
				console.log(parent_name)
				console.log(reset[0])
				//setDecisionPoint(decisionPoint+1);
				moveDecisionPoint(parent_name, null);
			    }

			}

		    });
		});
	    }
	})
    }

    function compare_dictionaries(x, y) {
	for (const [key, value] of Object.entries(x)) {
	    if (y[key].localeCompare(value, undefined, {sensitivity: 'base'})) {
		return false;
	    }
	}
	return true
    }


    useEffect(() => {
	if (vector && (doUpdate == true)) {
	    setDoUpdate(false);
	    get_final_decision();
	} else if (vector) {
	    if (!validate_dec_tree(decisions)) {
		/* invalidDecisions is empty (bc vector) but tree is still not
		   validating which means Decision has bogus value */
		get_final_decision();
	    }
	}
    }, [vector]);


    const get_final_decision = () => {
	let deduce = {};
        decisions.forEach((x) => {
	    if (x.label !== "Decision") {
		if (!Object.keys(children).includes(x.label)) {
		    /* ignore children decisions */
		    deduce[x.label] = x.value;
		}
	    }
        });

	for (var x =0; x < data.decisions_table.length; x++) {
	    if (compare_dictionaries(deduce, data.decisions_table[x])) {
		if (finalDecision) {
		    /* we just need to update final decision */
		    update_decision("Decision",  data.decisions_table[x]["Decision"]);
		} else {
		    setFinalDecision(data.decisions_table[x]["Decision"]);
		    setDecisions(decisions => [...decisions, {'label': 'Decision', 'value': data.decisions_table[x]["Decision"]}])
		}
		setFinalDecision(data.decisions_table[x]["Decision"]);
		console.log("FINAL DECISION IS ", data.decisions_table[x]["Decision"]);
		break;
	    }
	}
    }


    const make_vector = () => {

	if (invalidDecisions.length > 0) {
	    /*Don't do this*/
	    return;
	}
	var computed = "SSVC/v2/"
	var vector =  decisions.forEach((d, index) => {
	    let k = d.label;
	    let v = d.value;
	    if (d.label in shortKeys) {
		k = shortKeys[k].toUpperCase();
	    } else {
		k = d.label[0].toUpperCase();
	    }
	    if (d.value in shortKeys) {
		v = shortKeys[v].toUpperCase();
	    } else {
		v = d.value[0].toUpperCase();
	    }
	    computed = computed + k+":"+v+"/"
	})
	var q = new Date().toISOString().replace(/\..*$/,'Z');
	computed = computed+q+"/"
	setVector(computed);
    }

    useEffect(() => {
	let child_decisions = [];
	try {
	    if (decisions.length && data.decision_points.length) {
		if (decisions.length == data.decision_points.length) {
		    /* all decisions have been made */
		    if (doUpdate == false) {
			/* if we already have vector, this is just an update
			   and we need to recalculate decisions */
			setDoUpdate(true);
			child_decisions = decisions.filter(item => Object.keys(children).includes(item.label));
			get_combo_decision(child_decisions);
		    } else {
			make_vector();
		    }

		} else {
		    /* are both decisions with children made? */
		    if (children) {
			child_decisions = decisions.filter(item => Object.keys(children).includes(item.label));
			if (child_decisions.length == Object.keys(children).length) {
			    /* we have children decisions - find the combined decision */
			    console.log("GET COMBO")
			    get_combo_decision(child_decisions);
			}
		    }
		    let final_dec = decisions.filter(item => item.label === "Decision")
		    if (decisions.length == (data.decision_points.length - 1) && (final_dec.length == 0)) {
			/* FIND FINAL DECISION */
			console.log(decisions)
			console.log(data.decision_points)
			get_final_decision();

			
		    }
		}
	    }
	} catch (err) {
	    console.log("Data not as expected: ", err);
	}

    }, [decisions]);


    

    
    const moveDecisionPoint = (label, e) => {
	setUserInput(true);
	if ('scoreChange' in props) {
	    props.scoreChange(true);
	}
	/* get next decision point */
	data.decision_points.forEach((d, index) => {
	    if (d.label == label) {
		if (index == decisionPoint) {
		    if (e) {
			setDecisions(decisions => [...decisions, {'label':label, 'value': e.target.value}]);
		    }
		    /* if we're going through the decision tree, move it forward */
		    if ((index+2) != data.decision_points.length) {
			/* that was the last decision point */
			setDecisionPoint(index+1);
		    }
		} else {
		    /* this is an update to the decision tree */
		    if (e) {
			update_decision(label, e.target.value);
		    }
		}
	    }
	})
    }

    const GetComplexDecision = ({decisions, label}) => {

	let complex = decisions.filter((item) => (item.label == label));
	let variant = "info";
	if (complex.length == 1) {
	    switch(complex[0]['value']) {
	    case 'high':
		variant="danger";
		break;
	    case 'medium':
		variant='info';
		break;
	    case 'low':
		variant='success';
		break;
	    default:
		variant='secondary';
	    }
	}
	return (
	    complex.length > 0 ?
		<Alert
		    variant={variant} >
		    {complex.map((item, index) => {
			return (
			    <div key={`${item.label}-decision`} className="text-center">{item.label} is {item.value}</div>
			)
		    })}
		</Alert>
	    :
	    ""
	)
    };

    const removeScore = () => {
	props.remove();
	hideConfirmationModal();
	setDecisionPoint(0);
	setFinalDecision("");
	setDecisions([]);
	setJustifications({});
	setVector("");
    }
    
    const SSVCPopover = React.forwardRef(
	({ popper, children, show: _, ...props }, ref) => {
	    const {label, options} = props;

	    useEffect(() => {
		popper.scheduleUpdate();
	    }, [children, popper]);

	    return (
		<Popover ref={ref} body {...props}>
		    <Popover.Header as="h3">{label}</Popover.Header>
		    <Popover.Body>
			{options.map((o, index) => {
			    return (
				<p key={`${o.label}-${index}`}>
				    <b>{o.label}</b>:{"  "}
				    {o.description}
				</p>
			    )
			})}
		    </Popover.Body>
		</Popover>
	    )
	}
    )

    const showDecisionNotes = (label) => {

	if (showNotes.includes(label)) {
	    setShowNotes((item) => item.filter((select) => select != label))
	    
	} else {
	    setShowNotes(showNotes => [...showNotes, label])
	}
    }
    
    const handleAddDecisionNotes = (e) => {
	const key = e.target.name;
	const value = e.target.value;
	setJustifications({
	    ...justifications,
	    [key]:value
	});
	setUserInput(true);
	
    }

        /* useImperativeHandle is a React Hook that lets you customize the handle exposed as a ref. */
    /* this gets called when tabs change so score is saved between toggling cvss version tabs */

    useImperativeHandle(ref, () => ({
        saveScore,
    }));
    
    const saveScore = async (hide=true) => {
	const formData = {};
	let new_justifications = {};

	if (!userInput && !hide) {
	     /* in scoring app, user may not interact but stil wants to save score, so let them */
	    return;
	}
	setDisabledButton(true);
	
	justRef.current = justRef.current.slice(0, decisions.length);

	if (justifications) {
	    decisions.map((el, i) => {
		if (justRef.current[i]) {
		    new_justifications[el.label] = justRef.current[i].value;
		} else if (el.label in justifications) {
		    /* keep old note */
		    new_justifications[el.label] = justifications[el.label];
		}
	    });
	} else {
	    decisions.map((el, i) => (justRef.current[i] ? new_justifications[el.label] = justRef.current[i].value : ''));
	}
	if (mismatchRef?.current?.value) {
	    new_justifications['assessment_mismatch'] = mismatchRef.current.value;
	}
	formData['justifications'] = new_justifications;
	formData['decision_tree'] = decisions;
	formData['tree_type'] = decisionTree;
	formData['final_decision'] = finalDecision;
	formData['vector'] = vector ? vector : "not_calculated";
	console.log(formData);
	props.save(formData, hide);
    }

    const SSVCFormOption = (props) => {
	return (
	    <>
		<Col lg={4} className="d-grid">
		    <OverlayTrigger
			trigger="click"
			rootClose
			placement="right"
			overlay={<SSVCPopover
				     label={props.label}
				     options={props.options}
				 />}
		    >
			<Button
			    variant="primary">
			    {props.label}
			</Button>
		    </OverlayTrigger>
		</Col>
		<Col lg={6}>
		    {props.options.map((option, index) => {
			return (
			    <Form.Check
				type="radio"
				inline
				key={`${props.label}-${option.label}`}
				label={option.label}
				disabled={formLocked}
				aria-label={option.label}
				name={`ssvc-${props.label}`}
				value={option.label}
				defaultChecked={props.checked.toLowerCase() === option.label.toLowerCase() ? true : false}
				onChange={(e)=>(moveDecisionPoint(props.label, e))}
			    />
			)
		    })
		    }
		</Col>
	    </>
	)
    }
    
    return (
	<>
	<Row>
	    <Col lg={12}>
		<div className="d-flex justify-content-between pb-1 border-bottom mb-3">
		    <div>
			<Form.Group controlId="decisionTreeInput">
			    <Form.Label aria-labelledby="decision_tree">Decision Tree</Form.Label>
			    <Form.Select name="decision_tree" data-testid="decision-tree-select" value={decisionTree} onChange={(e)=>setDecisionTree(e.target.value)} aria_label="Decision Tree Select">
				{DECISION_TREE_CHOICES.map((choice) => (
				    <option key={choice.file} value={choice.file}>{choice.file}</option>
				))}
			    </Form.Select>
			</Form.Group>
			{/*<h5 className="mb-2">Currently using <b>{decisionTree}</b> as Decision Tree</h5>*/}
			<small>Click decision button to view description of each decision point.</small>
			
		    </div>
		    {props.assignment &&
		     <div>
			 <Form.Label>Assigned To:</Form.Label>
			 <AssignmentDropdownButton
			     options = {props.assignment}
			     assignUser ={props.assignUser}
			     owners = {props.owner ? [props.owner] : []}
			     auto_assign = {document.getElementById('auto_assignment')? true : false}
			 />
		     </div>
		    }
			 
		</div>
		{props.vul && props.vul.ssvc_decision &&
		 <div className="mb-3 mt-3">
		     {formLocked ?
		      <span><Button onClick={(e)=>toggleFormLock()} variant="btn btn-icon warningtext"><i className="fas fa-lock" title="Unlock vulnerability to score"></i></Button> This vulnerability has already been scored. Click the lock to reassess. </span>
		      :
		      <span><Button onClick={(e)=>toggleFormLock()} variant="btn btn-icon goodtext"><i className="fas fa-unlock" title="Lock vulnerability to prevent changes"></i></Button> Click the lock to prevent changes.</span>
		     }
		 </div>
		}

		{data.decision_points ?
		<div id="ssvc-assessment-form">
		     {data.decision_points.map((d, index) => {
			 if (index <= decisionPoint) {
			     if ((d.decision_type == "simple") && (index != data.decision_points.length - 1)) {
				 let checked = "";
				 if (decisions.length > 0) {
				     let old = decisions.filter((b) => b.label == d.label)
				     if (old.length > 0) 
					 checked = old[0]['value'];
				 }
				 /*if (props.vul && props.vul.ssvc_decision_tree) {
				   let old = props.vul.ssvc_decision_tree.filter((b) => b.label == d.label)
				   if (old.length > 0) {
				   console.log(props.vul.ssvc_decision_tree);
				   console.log(`Better Checked is ${old[0]['value']}`);
				   checked = old[0]['value']
				   }*/
				 return (
				     <React.Fragment key={`${d.label}-form`}>
					 <Row className="pb-3">
					     <SSVCFormOption
						 label = {d.label}
						 options = {d.options}
						 checked = {checked}
					     />
					     <Col lg={2} className="text-end">
						 <Button title={`Add ${d.label} Notes`} variant="btn-icon p-0 text-nowrap" onClick={() => showDecisionNotes(d.label)}><i className="fas fa-plus"></i>
						     {Object.keys(justifications).includes(d.label) && justifications[d.label] ?
						      ` View Notes`
						      :
						      ` Add Notes`
						     }
						 </Button>
					     </Col>
					 </Row>
					 <Row className={`pb-3 ${showNotes.includes(d.label) ? "": "hidden"}`}>
					      <Col lg={12}>
						  <Form.Label>{d.label} Decision Justification:</Form.Label>
						  <Form.Control name={d.label} as="textarea" rows={3} disabled={formLocked} defaultValue={justifications[d.label]} ref={el=>justRef.current[index] = el} onChange={(e)=>{'scoreChange' in props && props.scoreChange(true)}} />
						  {/*onChange={(e) => handleAddDecisionNotes(e)} />*/}
					      </Col>
					  </Row>
				     </React.Fragment>
				 )
			     } else if (index != data.decision_points.length - 1) {
				 return (
				     <GetComplexDecision
					 decisions = {decisions}
					 label={d.label}
					 key={`${d.label}-complex`}
				     />
				 )
			     }
			 }
		     })}
		 </div>
		 :
		 <p>Loading decision points...</p>
		}

		{invalidDecisions.length > 0 ?
		 <Alert variant="danger">
		     <div className="text-center">
			 This score has {invalidDecisions.length} invalid decisions: {invalidDecisions.join(', ')}
		     </div>
		 </Alert>
		 :
		 <>
		     {finalDecision &&
		      <>
			  <Alert variant={decisionColor}>
			      <div className="text-center">Decision is {finalDecision}{" "}
				  {props.preScore &&
				   <>
				       <Button variant="btn btn-icon" onClick={(e)=>showMismatch()}><i className='bx bxs-comment-error' title="Does this decision not match your expectation?"></i></Button>
				       <div className={`${showGutMismatch ? "": "hidden"}`}>
					    <Form.Label>Does this decision not match your expectation? Explain here:</Form.Label>
					    <Form.Control name="assessment_mismatch" as="textarea" rows={3} defaultValue={justifications['assessment_mismatch']} ref={mismatchRef} disabled={formLocked} onChange={(e)=>{'scoreChange' in props && props.scoreChange(true)}}/>
				       </div>
				   </>
				  }
			      </div>
			  </Alert>

			  <div className="d-flex justify-content-between mt-3">
			      {props.vul && props.vul.ssvc_decision ?
			       <Button variant="danger" disabled={formLocked} onClick={(e)=>setDisplayConfirmationModal(true)}>
				   Delete Score
			       </Button>
			       :
			       <div></div>
				  }
			      
			      
			      
			      <div>
				  <div className="d-flex justify-content-end gap-2">
				      <Button variant="secondary" onClick={props.hideModal}>
					  Cancel
				      </Button>
				      <Button variant="primary"
					      disabled={formLocked ? true: false}
					      type="submit"
					      onClick={(e)=>saveScore()}>
				      {disabledButton ? <>Saving...</>:<>Save Score</>}</Button>
				  </div>
				  <DeleteConfirmation
				      showModal={displayConfirmationModal}
				      confirmModal={removeScore}
				      hideModal={hideConfirmationModal}
				      id={1}
				      message={`Are you sure you want to delete the score? This cannot be undone.`}
                                  />
			      </div>
			  </div>
		      </>
		     }
		 </>
		}
	    </Col>
	</Row>
	</>
		 
    )

})
export default SSVCScore;
