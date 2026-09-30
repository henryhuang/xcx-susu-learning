Component({properties:{label:{type:String,value:'听发音'},playing:{type:Boolean,value:false}},methods:{tap(){this.triggerEvent('play');}}});
