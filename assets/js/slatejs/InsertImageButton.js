
import React, { Fragment, useState}  from 'react';
import { Button, Icon, Toolbar, Portal } from './components'
import {useSlateStatic} from 'slate-react';
import {insertImage, isImageUrl} from './utils/image.js'
import InsertImageDialog from './InsertImageDialog';

const InsertImageButton = ({uploadFiles}) => {
    const editor = useSlateStatic()

    const [error, setError] = useState(null);
    const [show, setShow] = useState(false);

    const doInsert = async (formData, filename) => {
	await uploadFiles(formData, filename).then(resp => {
            insertImage(editor, resp, filename);
            hide();
	}).catch(err => {
	    console.log(err);
	    setError("Error uploading file.");
	});
	    
    }

    const hide = () => {
        setShow(false);
    }

    /*
    const url = window.prompt('Enter the URL of the image:')
    if (url && !isImageUrl(url)) {
	alert('URL is not an image')
	return
    }
    url && insertImage(editor, url)
    */
    
    return (
	<>
	    <Button
		onMouseDown={event => {
		    event.preventDefault()
		    setShow(true);
		}}
	    >
		<Icon>image</Icon>
	    </Button>
	    <InsertImageDialog
		showModal = {show}
		hideModal={hide}
		insertImage={doInsert}
		error = {error}
	    />
	</>
    )
  }

  export default InsertImageButton;
