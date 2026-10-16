import type { Point } from './diagram-types';

/** The same inset diamond silhouette is used for paint, handles and connector endpoints. */
export function diamondGeometry(width:number,height:number) {
  const cx=width/2,cy=height/2,rx=Math.max(1,cx-2),ry=Math.max(1,cy-2);
  const points:Point[]=[{x:cx,y:cy-ry},{x:cx+rx,y:cy},{x:cx,y:cy+ry},{x:cx-rx,y:cy}];
  return {cx,cy,rx,ry,points};
}
export function diamondPerimeter(width:number,height:number,point:Point):Point {
  const {cx,cy,rx,ry}=diamondGeometry(width,height),dx=point.x-cx,dy=point.y-cy;
  const scale=Math.abs(dx)/rx+Math.abs(dy)/ry;
  return scale?{x:cx+dx/scale,y:cy+dy/scale}:{x:cx+rx,y:cy};
}
