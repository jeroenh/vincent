import { useSlateStatic,  useFocused, useSelected } from 'slate-react'
import React from 'react';
import Image from './Image.js';
import { Button, Icon, Toolbar, Portal } from './components'
import {removeLink} from "./utils/link.js"
import {
    Element as SlateElement
} from 'slate';


const Link = ({ attributes, element, children }) => {
    const editor = useSlateStatic();
    const selected = useSelected();
    const focused = useFocused();
    
    return (
      <div className="element-link">
          <a {...attributes} href={element.href}>
            {children}
	      {/* {element.children[0]?.type === "image" &&
	     <Image attributes={attributes} element={element.children[0]} children={element.children[0]?.children} />
	     }*/}
        </a>
        {selected && focused && (
          <div className="popup" contentEditable={false}>
              <a href={element.href} rel="noreferrer" target="_blank">
		  <Icon>link</Icon>
		  {element.href}
              </a>
              <Button onClick={() => removeLink(editor)}>
		  <Icon>link_off</Icon>
              </Button>
          </div>
        )}
      </div>
    );
};


export default Link;
