( function () {

	/**
	 * Interface widget to choose among various deeds -- for instance, if own work, or not own work, or other such cases.
	 *
	 * @param {Object} config The UW config
	 * @param {string|jQuery} selector Where to put this deed chooser
	 * @param {Object} deeds Keyed object of UploadWizardDeed items
	 * @param {UploadWizardUpload[]} uploads Uploads that this applies to (this is just to make deleting and plurals work)
	 */
	mw.UploadWizardDeedChooser = function ( config, selector, deeds, uploads ) {
		var chooser = this;
		this.$selector = $( selector );
		this.uploads = uploads;
		this.deeds = deeds;

		// name for radio button set
		mw.UploadWizardDeedChooser.prototype.widgetCount++;
		this.name = 'deedChooser' + mw.UploadWizardDeedChooser.prototype.widgetCount.toString();

		this.onLayoutReady = function () {};

		Object.keys( this.deeds ).forEach( function ( name ) {
			var deed = chooser.deeds[ name ],
				id = chooser.name + '-' + deed.name,
				$deedInterface = $( '<div>' ).addClass( 'mwe-upwiz-deed mwe-upwiz-deed-' + deed.name ).append(
					$( '<div>' ).addClass( 'mwe-upwiz-deed-option-title' ).append(
						$( '<span>' ).addClass( 'mwe-upwiz-deed-header' ).append(
							$( '<input>' ).attr( { id: id, name: chooser.name, type: 'radio', value: deed.name } ),
							$( '<label>' ).attr( { for: id } ).addClass( 'mwe-upwiz-deed-name' ).html(
								mw.message( 'mwe-upwiz-source-' + deed.name, chooser.uploads.length ).escaped()
							)
						)
					),
					$( '<div>' ).addClass( 'mwe-upwiz-deed-form' ).hide()
				);

			chooser.$selector.append( $deedInterface );

			deed.setFormFields( $deedInterface.find( '.mwe-upwiz-deed-form' ) );

			if ( deeds.length === 1 ) {
				chooser.onLayoutReady = chooser.selectDeed.bind( chooser, deed );
			} else {
				if ( config.licensing.defaultType === deed.name ) {
					chooser.onLayoutReady = chooser.selectDeed.bind( chooser, deed );
				}
				$deedInterface.find( 'span.mwe-upwiz-deed-header input' ).on( 'click', function () {
					if ( $( this ).is( ':checked' ) ) {
						chooser.selectDeed( deed );
					}
				} );
			}
		} );

		// deselect all deeds
		this.deselectDeedInterface( this.$selector.find( '.mwe-upwiz-deed' ) );
	};

	mw.UploadWizardDeedChooser.prototype = {
		/**
		 * How many deed choosers there are (important for creating unique ids, element names)
		 */
		widgetCount: 0,

		/**
		 * Check if this form is filled out correctly.
		 *
		 * @return {boolean} true if valid, false if not
		 */
		valid: function () {
			return !!this.deed;
		},

		/**
		 * Uploads this deed controls
		 */
		uploads: [],

		selectDeed: function ( deed ) {
			var $deedInterface = this.$selector.find( '.mwe-upwiz-deed.mwe-upwiz-deed-' + deed.name );

			this.choose( deed );
			this.selectDeedInterface( $deedInterface );
			$deedInterface.find( 'span.mwe-upwiz-deed-header input' ).prop( 'checked', true );
		},

		choose: function ( deed ) {
			var chooser = this;

			this.deed = deed;

			this.uploads.forEach( function ( upload ) {
				upload.deedChooser = chooser;
			} );

			// eslint-disable-next-line no-jquery/no-global-selector
			$( '#mwe-upwiz-stepdiv-deeds .mwe-upwiz-button-next' ).show();
		},

		/**
		 * From the deed choices, make a choice fade to the background a bit, hide the extended form
		 *
		 * @param {jQuery} $deedSelector
		 */
		deselectDeedInterface: function ( $deedSelector ) {
			$deedSelector.removeClass( 'selected' );
			$deedSelector.find( '.mwe-upwiz-deed-form' ).each( function () {
				var $form = $( this );
				// Prevent validation of deselected deeds by disabling all form inputs
				$form.find( ':input' ).prop( 'disabled', true );
				if ( $form.parents().is( ':hidden' ) ) {
					$form.hide();
				} else {
					// FIXME: Use CSS transition
					// eslint-disable-next-line no-jquery/no-slide
					$form.slideUp( 500 );
				}
			} );
		},

		/**
		 * From the deed choice page, show a particular deed
		 *
		 * @param {jQuery} $deedSelector
		 */
		selectDeedInterface: function ( $deedSelector ) {
			var $otherDeeds = $deedSelector.siblings().filter( '.mwe-upwiz-deed' );
			this.deselectDeedInterface( $otherDeeds );
			// FIXME: Use CSS transition
			// eslint-disable-next-line no-jquery/no-fade
			$deedSelector.addClass( 'selected' ).fadeTo( 'fast', 1.0 );
			$deedSelector.find( '.mwe-upwiz-deed-form' ).each( function () {
				var $form = $( this );
				// (Re-)enable all form inputs
				$form.find( ':input' ).prop( 'disabled', false );
				if ( $form.is( ':hidden' ) ) {
					// if the form was hidden, set things up so a slide-down works
					// FIXME: Use CSS transition
					// eslint-disable-next-line no-jquery/no-slide
					$form.show().slideUp( 0 );
				}
				// FIXME: Use CSS transition
				// eslint-disable-next-line no-jquery/no-slide
				$form.slideDown( 500 );
			} );
		},

		remove: function () {
			this.$selector.html( '' );
		},

		/**
		 * @return {Object}
		 */
		getSerialized: function () {
			return this.valid() ? this.deed.getSerialized() : {};
		},

		/**
		 * @param {Object} serialized
		 */
		setSerialized: function ( serialized ) {
			var deed;

			if ( serialized.name && serialized.name in this.deeds ) {
				deed = this.deeds[ serialized.name ];
				deed.setSerialized( serialized );
				this.selectDeed( deed );
			}
		}

	};

}() );
