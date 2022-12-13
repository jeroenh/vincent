import React from 'react'
import { useSelected, useSlateStatic, useFocused } from "slate-react";
import { ReactEditor } from "slate-react";
import { css } from '@emotion/css'
import { Button, Icon  } from './components'
import { Transforms } from 'slate';



function getIcon(url) {

    const extension = url.split('.').pop()

    if (["doc", "docx"].includes(extension)) {
        return "fas fa-file-word"
    }else if (["xls", "xlst"].includes(extension)) {
        return "fas fa-file-excel"
    } else if (["ppt", "pptx"].includes(extension)) {
        return "fas fa-file-powerpoint"
    } else if (["pdf"].includes(extension)) {
        return "fas fa-file-pdf"
    } else if (["zip", "tar", "tarz", "bzip", "7z"].includes(extension)) {
        return "fas fa-file-archive"
    } else if (["json", "xml", "html", "py", "sh"].includes(extension)) {
        return "fas fa-code"
    } else if (["mov"].includes(extension)) {
	return "fas fa-video"
    } else {
        return "fas fa-file"
    }
}


const FileIcon = ({ attributes, element, children }) => {
    const editor = useSlateStatic()
    const path = ReactEditor.findPath(editor, element)
    const selected = useSelected()
    const focused = useFocused()

    return (
	<div {...attributes}>
        <div

            contentEditable={false}
            className={css`
            position: relative;
          `}
        >
	    <i className={`${getIcon(element.children[0].text)}`}></i>{" "}
	    {element.children[0].text}
          <Button
            active
            onClick={() => Transforms.removeNodes(editor, { at: path })}
            className={css`
              display: ${selected && focused ? 'inline' : 'none'};
              position: absolute;
              top: 0.5em;
              left: 0.5em;
              background-color: white;
            `}
          >
            <Icon>delete</Icon>
          </Button>
        </div>
	</div>
    )
}
  

export default FileIcon;
