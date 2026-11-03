// Convert a browser text selection to original UTF-16 offsets without editing the DOM.
export function selectedOriginalRange(root,selection,original){
 if(!root||!selection||selection.isCollapsed||selection.rangeCount!==1||root.textContent!==original)return null;
 const range=selection.getRangeAt(0),inside=node=>node===root||root.contains(node);
 if(!inside(range.startContainer)||!inside(range.endContainer))return null;
 const prefix=root.ownerDocument.createRange();prefix.selectNodeContents(root);prefix.setEnd(range.startContainer,range.startOffset);const start=prefix.toString().length;
 prefix.setEnd(range.endContainer,range.endOffset);const end=prefix.toString().length;
 if(start>=end||original.slice(start,end)!==range.toString())return null;
 return{start,end};
}
