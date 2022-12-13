const Paragraph = ({ attributes, children }) => (
  <div {...attributes} className="element-paragraph">
    {children}
  </div>
);

export default Paragraph;
